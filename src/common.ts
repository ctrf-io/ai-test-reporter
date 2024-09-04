import { CtrfReport } from "../types/ctrf";
import fs from 'fs';

export function validateCtrfFile(filePath: string): CtrfReport | null {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const jsonData: CtrfReport = JSON.parse(fileContent);

        if (!jsonData.results?.summary || !jsonData.results.tests) {
            console.warn('Warning: The file does not contain valid CTRF data.');
            return null;
        }
        return jsonData;
    } catch (error) {
        console.error('Failed to read or process the file:', error);
        return null;
    }
}

export function saveUpdatedReport(filePath: string, report: CtrfReport) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
        console.log(`Updated report saved to ${filePath}`);
    } catch (error) {
        console.error('Failed to save the updated report:', error);
    }
}
