import * as Papa from 'papaparse';
import * as fs from 'fs';
import * as path from 'path';

export async function processCommonNames(): Promise<void> {
  console.log('\n📝 Processing common names...');

  try {
    // Read CSV from Desktop
    const csvPath = path.join(
      process.env.HOME!,
      'Desktop',
      'TAGIS - nomes comuns Borboletas de Portugal final.xlsx - Folha1.csv'
    );

    if (!fs.existsSync(csvPath)) {
      console.warn(`⚠️  CSV file not found at: ${csvPath}`);
      console.warn('   Skipping common names processing');
      return;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');

    // Parse CSV
    const { data } = Papa.parse(csvContent, { header: true });

    // Create lookup map: { "Aricia cramera": "Aricia-do-sul", ... }
    const commonNamesMap: Record<string, string> = {};
    data.forEach((row: any) => {
      if (row.ESPÉCIE && row['NOME COMUM']) {
        commonNamesMap[row.ESPÉCIE] = row['NOME COMUM'];
      }
    });

    // Save to public/data/common-names.json
    const outputPath = path.join(__dirname, '../../public/data/common-names.json');
    fs.writeFileSync(outputPath, JSON.stringify(commonNamesMap, null, 2));

    console.log(`✅ Processed ${Object.keys(commonNamesMap).length} common names`);
    console.log(`   Output: ${outputPath}`);
  } catch (error) {
    console.error('❌ Error processing common names:', error);
    throw error;
  }
}
