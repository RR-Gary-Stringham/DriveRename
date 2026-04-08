import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Play, Code, FileJson, Copy, Check, RefreshCw } from "lucide-react";
import { getRenameSuggestions, FileSuggestion, initGemini } from "@/src/services/geminiService";
import { AppsScriptResponse, DriveFile, RenameResponse } from "@/src/lib/drive-service";

export default function RenameLogicGenerator() {
  const [fileInput, setFileInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([]);
  const [intent, setIntent] = useState("Organize by date and project name");
  const [suggestions, setSuggestions] = useState<FileSuggestion[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch API key from Apps Script if available
    // @ts-ignore
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      // @ts-ignore
      google.script.run
        .withSuccessHandler((key: string) => {
          if (key) {
            initGemini(key);
            console.log("Gemini initialized with Apps Script key");
          } else {
            console.warn("Backend Error Logic: No API key returned from Apps Script.");
          }
        })
        .withFailureHandler((err: Error) => {
          console.error("Script Execution Crashed (getGeminiApiKey):", err);
        })
        .getGeminiApiKey();
    }
  }, []);

  const handleExecuteRenaming = async () => {
    const selectedSuggestions = suggestions.filter((s) => selectedIds.has(s.id));
    if (selectedSuggestions.length === 0) {
      toast.error("No suggestions selected for renaming.");
      return;
    }

    // @ts-ignore
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      toast.info("Apps Script environment not detected. Renaming simulation only.");
      console.log("Simulating rename for:", selectedSuggestions);
      return;
    }

    setRenaming(true);
    let successCount = 0;
    let failCount = 0;

    const renamePromises = selectedSuggestions.map((item) => {
      return new Promise<void>((resolve) => {
        // @ts-ignore
        google.script.run
          .withSuccessHandler((response: RenameResponse) => {
            if (response.success) {
              console.log(`Successfully renamed to ${response.newName}`);
              successCount++;
            } else {
              console.error(`Backend Error Logic (renameFile): ${response.error}`);
              failCount++;
            }
            resolve();
          })
          .withFailureHandler((err: Error) => {
            console.error(`Script Execution Crashed (renameFile):`, err);
            failCount++;
            resolve();
          })
          .renameFile(item.id, item.proposedName);
      });
    });

    await Promise.all(renamePromises);
    setRenaming(false);

    if (successCount > 0) {
      toast.success(`Successfully renamed ${successCount} files.`);
      // Refresh the list or remove renamed items
      setSuggestions(prev => prev.filter(s => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
    }
    if (failCount > 0) {
      toast.error(`Failed to rename ${failCount} files. Check console for details.`);
    }
  };

  const fetchFiles = () => {
    setFetching(true);
    try {
      // @ts-ignore - google is provided by the Apps Script environment
      if (typeof google !== 'undefined' && google.script && google.script.run) {
        // @ts-ignore
        google.script.run
          .withSuccessHandler((response: AppsScriptResponse) => {
            setFetching(false);
            if (response.success && response.files) {
              setSelectedFiles(response.files);
              toast.success(`Fetched ${response.files.length} files from Drive`);
            } else {
              console.error("Backend Error Logic (getSelectedFiles):", response.error);
              toast.error(response.error || "Failed to fetch files");
            }
          })
          .withFailureHandler((err: Error) => {
            setFetching(false);
            console.error("Script Execution Crashed (getSelectedFiles):", err);
            toast.error("Apps Script Error: " + err.message);
          })
          .getSelectedFiles();
      } else {
        setFetching(false);
        toast.info("Apps Script environment not detected. Using manual input.");
      }
    } catch (error) {
      setFetching(false);
      console.error("Fetch error:", error);
    }
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0 && !fileInput.trim()) {
      toast.error("Please provide some file names or fetch selected files.");
      return;
    }

    setLoading(true);
    console.log("Starting analysis with intent:", intent);
    try {
      let files: { id: string; name: string; content?: string }[] = [];

      if (selectedFiles.length > 0) {
        files = selectedFiles.map(f => ({ 
          id: f.fileId, 
          name: f.currentName,
          content: f.content 
        }));
      } else {
        // Parse manual input: assume one file per line or comma-separated
        const lines = fileInput.split(/\n|,/).filter((l) => l.trim());
        files = lines.map((line, index) => {
          const parts = line.split("|");
          return {
            id: parts[1]?.trim() || `id-${index}`,
            name: parts[0]?.trim() || line.trim(),
          };
        });
      }

      console.log("Parsed files for analysis:", files);
      const result = await getRenameSuggestions(files, intent);
      console.log("Analysis result:", result);
      
      setSuggestions(result);
      setSelectedIds(new Set(result.map((s) => s.id)));
      
      if (result.length > 0) {
        toast.success("Suggestions generated!");
      } else {
        toast.warning("Gemini returned no suggestions. Try a different intent.");
      }
    } catch (error: any) {
      console.error("Analyze error details:", error);
      
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes("API key not valid") || errorMessage.includes("API_KEY_INVALID")) {
        toast.error("Invalid Gemini API Key. Please check your Script Properties in Google Apps Script.");
      } else if (errorMessage.includes("quota") || errorMessage.includes("429")) {
        toast.error("Gemini API quota exceeded. Please try again later.");
      } else if (errorMessage.includes("503") || errorMessage.includes("UNAVAILABLE") || errorMessage.includes("high demand") || errorMessage.includes("overloaded")) {
        toast.error("Gemini is currently busy (High Demand). Please wait a few seconds and try again.");
      } else {
        toast.error("Failed to generate suggestions. Check console for details.");
      }
    } finally {
      setLoading(false);
    }
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.fileId !== id));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === suggestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suggestions.map((s) => s.id)));
    }
  };

  const generateAppsScript = () => {
    const selectedSuggestions = suggestions.filter((s) => selectedIds.has(s.id));
    
    const gsCode = `/**
 * Google Apps Script Add-on logic for renaming files.
 * Generated by DriveRename AI.
 */

/**
 * Builds the Card UI for renaming confirmation.
 * @param {Array} suggestions List of {id, originalName, proposedName, reasoning}
 * @return {CardService.Card}
 */
function buildRenameCard(suggestions) {
  try {
    const card = CardService.newCardBuilder();
    card.setHeader(CardService.newCardHeader().setTitle('Rename Suggestions'));

    const section = CardService.newCardSection();
    
    suggestions.forEach((item, index) => {
      const checkbox = CardService.newSelectionInput()
        .setType(CardService.SelectionInputType.CHECK_BOX)
        .setFieldName('rename_' + item.id)
        .addItem(item.originalName + ' → ' + item.proposedName, item.id, true);
      
      section.addWidget(checkbox);
      section.addWidget(CardService.newTextParagraph().setText('Reason: ' + item.reasoning));
    });

    const action = CardService.newAction().setFunctionName('executeRename');
    const button = CardService.newTextButton()
      .setText('Execute Renaming')
      .setOnClickAction(action);

    section.addWidget(button);
    card.addSection(section);

    return card.build();
  } catch (e) {
    console.error('Error building card:', e);
    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle('Error'))
      .addSection(CardService.newCardSection().addWidget(CardService.newTextParagraph().setText(e.toString())))
      .build();
  }
}

/**
 * Callback function to handle the final renaming.
 * @param {Object} event The event object from CardService.
 */
function executeRename(event) {
  try {
    const formInputs = event.formInputs;
    const renamedCount = 0;
    
    // In a real add-on, you might store the mapping in PropertiesService
    // or pass it via hidden parameters in the action.
    // For this example, we assume a global or accessible mapping.
    const nameMapping = JSON.parse(PropertiesService.getUserProperties().getProperty('RENAME_MAPPING') || '{}');

    for (const key in formInputs) {
      if (key.startsWith('rename_')) {
        const fileId = formInputs[key][0];
        const newName = nameMapping[fileId];
        
        if (newName) {
          const file = DriveApp.getFileById(fileId);
          file.setName(newName);
          console.log('Renamed ' + fileId + ' to ' + newName);
          renamedCount++;
        }
      }
    }

    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Successfully renamed ' + renamedCount + ' files.'))
      .build();
  } catch (e) {
    console.error('Error executing rename:', e);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText('Error: ' + e.toString()))
      .build();
  }
}
`;
    return gsCode;
  };

  const jsonSchema = {
    type: "object",
    properties: {
      suggestions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            originalName: { type: "string" },
            proposedName: { type: "string" },
            reasoning: { type: "string" },
          },
          required: ["id", "originalName", "proposedName", "reasoning"],
        },
      },
    },
    required: ["suggestions"],
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full min-h-screen bg-[#E4E3E0] text-[#141414] font-sans">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <header className="flex justify-between items-end border-b border-[#141414] pb-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter uppercase">DriveRename AI</h1>
            <p className="font-serif italic text-sm opacity-60">Logical File Organization Specialist</p>
          </div>
          <Badge variant="outline" className="border-[#141414] rounded-none px-4 py-1">v1.0.0</Badge>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Section */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-none border-[#141414] bg-transparent shadow-none">
            <CardHeader className="border-b border-[#141414]">
              <CardTitle className="text-xs uppercase tracking-widest font-mono">Input Data</CardTitle>
              <CardDescription className="font-serif italic text-xs">Enter file names (one per line or name|id)</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase font-mono opacity-50">File List</label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={fetchFiles}
                      disabled={fetching}
                      className="h-6 text-[10px] uppercase font-mono border border-[#141414]/20 rounded-none hover:bg-[#141414] hover:text-[#E4E3E0]"
                    >
                      {fetching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Fetch Selected
                    </Button>
                  </div>
                  
                  {selectedFiles.length > 0 ? (
                    <div className="space-y-2">
                      <ScrollArea className="h-[200px] border border-[#141414] bg-white/50 p-2 rounded-none">
                        <div className="space-y-1">
                          {selectedFiles.map((f) => (
                            <div key={f.fileId} className="flex justify-between items-center p-1.5 border-b border-[#141414]/5 text-[11px] font-mono group hover:bg-[#141414]/5">
                              <span className="truncate mr-2">{f.currentName}</span>
                              <button 
                                onClick={() => removeFile(f.fileId)}
                                className="opacity-0 group-hover:opacity-100 text-[#141414]/40 hover:text-red-600 transition-opacity px-1"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="flex justify-end">
                        <Button 
                          variant="link" 
                          size="sm" 
                          onClick={() => setSelectedFiles([])}
                          className="text-[9px] uppercase font-mono h-auto p-0 opacity-50 hover:opacity-100"
                        >
                          Clear Selection
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Textarea
                      placeholder="Invoice_2023.pdf&#10;Report_Final_v2.docx|id-123&#10;IMG_001.jpg"
                      className="min-h-[200px] rounded-none border-[#141414] focus-visible:ring-0 bg-white/50"
                      value={fileInput}
                      onChange={(e) => setFileInput(e.target.value)}
                    />
                  )}
                </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-mono opacity-50">Renaming Intent</label>
                <Input
                  placeholder="e.g. Organize by project and date"
                  className="rounded-none border-[#141414] focus-visible:ring-0 bg-white/50"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={loading}
                className="w-full rounded-none bg-[#141414] text-[#E4E3E0] hover:bg-[#141414]/90"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Analyze with Gemini
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="suggestions" className="w-full">
            <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-[#141414] p-0 h-auto">
              <TabsTrigger
                value="suggestions"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#141414] data-[state=active]:bg-transparent px-6 py-3 text-xs uppercase font-mono"
              >
                Suggestions
              </TabsTrigger>
              <TabsTrigger
                value="code"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#141414] data-[state=active]:bg-transparent px-6 py-3 text-xs uppercase font-mono"
              >
                Apps Script (.gs)
              </TabsTrigger>
              <TabsTrigger
                value="schema"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#141414] data-[state=active]:bg-transparent px-6 py-3 text-xs uppercase font-mono"
              >
                JSON Schema
              </TabsTrigger>
            </TabsList>

            <TabsContent value="suggestions" className="mt-6">
              <Card className="rounded-none border-[#141414] bg-transparent shadow-none overflow-hidden">
                <div className="p-4 border-b border-[#141414] flex justify-between items-center bg-white/30">
                  <div className="text-[10px] uppercase font-mono opacity-60">
                    {selectedIds.size} of {suggestions.length} selected
                  </div>
                  <Button
                    onClick={handleExecuteRenaming}
                    disabled={renaming || selectedIds.size === 0}
                    size="sm"
                    className="rounded-none bg-[#141414] text-[#E4E3E0] hover:bg-[#141414]/90 h-8 text-[10px] uppercase font-mono"
                  >
                    {renaming ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <Check className="mr-2 h-3 w-3" />}
                    Execute Renaming
                  </Button>
                </div>
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader className="bg-[#141414] text-[#E4E3E0]">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="w-[50px] text-[#E4E3E0]">
                          <Checkbox
                            checked={suggestions.length > 0 && selectedIds.size === suggestions.length}
                            onCheckedChange={toggleAll}
                            className="border-[#E4E3E0] data-[state=checked]:bg-[#E4E3E0] data-[state=checked]:text-[#141414]"
                          />
                        </TableHead>
                        <TableHead className="text-[#E4E3E0] text-[10px] uppercase font-mono">Original Name</TableHead>
                        <TableHead className="text-[#E4E3E0] text-[10px] uppercase font-mono">Proposed Name</TableHead>
                        <TableHead className="text-[#E4E3E0] text-[10px] uppercase font-mono">Reasoning</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suggestions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 font-serif italic opacity-40">
                            No data analyzed yet.
                          </TableCell>
                        </TableRow>
                      ) : (
                        suggestions.map((s) => (
                          <TableRow key={s.id} className="border-b border-[#141414]/10 hover:bg-[#141414] hover:text-[#E4E3E0] group transition-colors">
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(s.id)}
                                onCheckedChange={() => toggleSelect(s.id)}
                                className="border-[#141414] group-hover:border-[#E4E3E0] data-[state=checked]:bg-[#141414] data-[state=checked]:text-[#E4E3E0] group-hover:data-[state=checked]:bg-[#E4E3E0] group-hover:data-[state=checked]:text-[#141414]"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-xs">{s.originalName}</TableCell>
                            <TableCell className="font-mono text-xs font-bold">{s.proposedName}</TableCell>
                            <TableCell className="font-serif italic text-xs opacity-70 group-hover:opacity-100">{s.reasoning}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            </TabsContent>

            <TabsContent value="code" className="mt-6">
              <Card className="rounded-none border-[#141414] bg-transparent shadow-none">
                <CardHeader className="flex flex-row items-center justify-between border-b border-[#141414] space-y-0">
                  <div>
                    <CardTitle className="text-xs uppercase tracking-widest font-mono">Apps Script Generator</CardTitle>
                    <CardDescription className="font-serif italic text-xs">Copy this to your Code.gs file</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-none hover:bg-[#141414] hover:text-[#E4E3E0]"
                    onClick={() => copyToClipboard(generateAppsScript())}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px] bg-[#141414] text-[#E4E3E0] p-4 font-mono text-[11px] leading-relaxed">
                    <pre>{generateAppsScript()}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schema" className="mt-6">
              <Card className="rounded-none border-[#141414] bg-transparent shadow-none">
                <CardHeader className="flex flex-row items-center justify-between border-b border-[#141414] space-y-0">
                  <div>
                    <CardTitle className="text-xs uppercase tracking-widest font-mono">JSON Logic Schema</CardTitle>
                    <CardDescription className="font-serif italic text-xs">Structure for renaming logic</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-none hover:bg-[#141414] hover:text-[#E4E3E0]"
                    onClick={() => copyToClipboard(JSON.stringify(jsonSchema, null, 2))}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px] bg-[#141414] text-[#E4E3E0] p-4 font-mono text-[11px] leading-relaxed">
                    <pre>{JSON.stringify(jsonSchema, null, 2)}</pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="pt-12 border-t border-[#141414] flex justify-between items-center opacity-40 text-[10px] uppercase font-mono">
        <span>Google Workspace Developer Tool</span>
        <span>Powered by Gemini 3 Flash</span>
      </footer>
    </div>
  </div>
  );
}
