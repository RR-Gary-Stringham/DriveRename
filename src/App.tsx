/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import RenameLogicGenerator from "./components/RenameLogicGenerator";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <>
      <RenameLogicGenerator />
      <Toaster />
    </>
  );
}
