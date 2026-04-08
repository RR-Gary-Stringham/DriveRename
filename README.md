# **GEMINI DRIVE RENAMER**

A Google Workspace Add-on for Google Drive that uses **Gemini 1.5 Flash** to analyze selected files and suggest professional, organized filenames. This tool features a "Review & Approve" workflow, ensuring no files are renamed without your explicit consent.

## **ARCHITECTURE**

This project uses a hybrid architecture to bypass Google Apps Script limitations:

* **Frontend:** React \+ Tailwind CSS (Vite) bundled into a single monolithic HTML file.  
* **Backend:** Google Apps Script (.gs) acting as a bridge to the Google Drive API.  
* **AI:** Gemini API via Google AI Studio for intelligent name generation and JSON structuring.

## 

## **GETTING STARTED**

### **Prerequisites**

* **Node.js** & **pnpm** installed.  
* **clasp** installed globally: pnpm add \-g @google/clasp.  
* **Google Apps Script API** enabled at [script.google.com/home/usersettings](https://script.google.com/home/usersettings).

##

# Run and deploy from AI Studio app

View the app in AI Studio: https://ai.studio/apps/07a16992-c6f1-4408-b04d-a718cbaadefa

##

## **ENVIRONMENT SETUP**

Create a .env file in the root directory to store your configuration or copy the .env.example:

Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key

<br>
**Optional**
 
Set APP_URL="MY_APP_URL"

The URL where this applet is hosted. AI Studio automatically injects this at runtime with the Cloud Run service URL.This setting is not normally needed unless you need to link back to your script (for a webhook or a callback), the "URL" would be the Web App URL of your Google Apps Script.

If you do, you can find this by:

1. Going to script.google.com.
2. Clicking Deploy > Manage Deployments.
3. Copying the Web App URL (it usually ends in /exec).

##

## RUN LOCALLY

### **Installation**

\# Clone the repository  
git clone \[https://github.com/RR-Gary-Stringham/DriveRename.git\](https://github.com/RR-Gary-Stringham/DriveRename.git) 

1. Install dependencies:
   `npm install` or    `pnpm install`
  
2. cd DriveRename

3. Create a .env file in the root directory to store your AI Studio key:
	Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
	
4. Run the app:
   `npm run dev` or `pnpm run dev`


### **Connect to Google Apps Script**

\# Login to your Google account  
clasp login


# Login to your Google account
clasp login

# Create the script project using the convenience script
`npm run clasp:create` or `pnpm run clasp:create`

runs the command to create the script project (Select 'standalone')  
clasp create \--title "Gemini Drive Renamer" \--type standalone \--rootDir .


## **Development & Deployment**

### **Local Web Development**

To test the UI, components, and styling in your local browser (Note: Drive API calls will not work locally):

pnpm run dev

### **Deploying to Google Drive**

Google Apps Script requires all frontend code to be inlined. Use the custom build-and-push command:

1. **Build & Push:**  
   pnpm run deploy

   *This command runs pnpm run build:gs (which executes vite build \--mode gscript) to consolidate assets into dist/index.html, then executes clasp push.*  
2. **Test the Add-on:**  
   * Open [script.google.com](https://script.google.com) and open your project.  
   * Click **Deploy** \> **Test deployments**.  
   * Select **Google Workspace Add-on** and install it for your Google Drive.  
   * 

## 

## **PROJECT STRUCTURE**

| File/Folder | Description |
| :---- | :---- |
| src/ | React frontend source code (TypeScript). |
| scripts/code.gs | Server-side Apps Script logic for Drive interaction. |
| appsscript.json | Manifest file defining Add-on behavior and UI triggers. |
| vite.config.ts | Uses vite-plugin-singlefile for the gscript build mode. |
| .claspignore | Prevents source code and node\_modules from being uploaded to Google. |
| .gitignore | Prevents clasp credentials and .env files from being pushed to GitHub. |

##

## **SECURITY & PERMISSIONS**

The add-on requests the following OAuth scopes:

* drive.readonly: To read the names of selected files for AI analysis.  
* drive.file: To apply the new names to files you approve.  
* script.external\_request: To communicate with the Gemini API.

## 

## **LICENSE**

MIT © REVREBEL | [Gary Stringham](https://github.com/RR-Gary-Stringham)

<div align="left">
<img width="600"  alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>




