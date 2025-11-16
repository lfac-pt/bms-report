/* eslint-disable no-undef */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import autoTable from "jspdf-autotable";

interface ExportOptions {
  selectedYears: number[];
  targetTransect: string | null;
  targetSection: string | null;
  targetTransectName: string | null;
}

export async function exportToPDF(options: ExportOptions): Promise<void> {
  const { selectedYears, targetTransect, targetSection, targetTransectName } = options;

  // Create PDF document
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;

  // Add header
  pdf.setFontSize(20);
  pdf.text("Relatório BMS " + targetTransectName, margin, margin + 10);

  // Add filter information
  pdf.setFontSize(10);
  let yPosition = margin + 20;

  pdf.text(`Anos: ${selectedYears.join(", ")}`, margin, yPosition);
  yPosition += 6;

  if (targetSection) {
    pdf.text(`Secção: ${targetSection}`, margin, yPosition);
    yPosition += 6;
  }

  pdf.setFontSize(8);
  pdf.text(`Gerado em: ${new Date().toLocaleString("pt-PT")}`, margin, yPosition);
  yPosition += 10;

  // Export charts
  const chartElements = document.querySelectorAll<HTMLElement>("[data-chart-export]");
  for (let i = 0; i < chartElements.length; i++) {
    const element = chartElements[i];
    const exportAsTable = element.hasAttribute("data-export-as-table");
    const chartExportTitle = element.getAttribute("data-chart-export-title");

    // Add new page for the charts
    if (i === 1) {
      pdf.addPage();
      yPosition = margin + 10;
    }

    // Add chart title if data-chart-export-title is present
    if (chartExportTitle) {
      pdf.setFontSize(14);
      pdf.text(chartExportTitle, margin, yPosition);
      yPosition += 10;
    }

    if (exportAsTable) {
      // Export as native table
      const tableData = extractTableData(element);

      if (tableData.headers.length > 0 && tableData.rows.length > 0) {
        autoTable(pdf, {
          head: [tableData.headers],
          body: tableData.rows,
          startY: yPosition,
          margin: { left: margin, right: margin },
          styles: {
            fontSize: 9,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: [66, 139, 202],
            textColor: 255,
            fontStyle: "bold",
            fontSize: 10,
          },
          theme: "grid",
        });

        yPosition = (pdf as any).lastAutoTable.finalY + 10;
      }
    } else {
      // Export as image
      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          logging: false,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageWidth - 2 * margin;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Check if image fits on current page
        if (yPosition + imgHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }

        pdf.addImage(imgData, "PNG", margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
      } catch (_error) {
        // Error capturing chart
        throw new Error(`Failed to capture chart ${i}`);
      }
    }
  }

  // Export table - temporarily show all rows
  const tableElement = document.querySelector<HTMLElement>("[data-table-export]");
  if (tableElement) {
    // Wait a bit for any rendering to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    pdf.addPage();
    yPosition = margin + 10;

    pdf.setFontSize(14);
    pdf.text("Frequência e Abundância", margin, yPosition);
    yPosition += 10;

    // Extract table data
    const tableData = extractTableData(tableElement);

    if (tableData.headers.length > 0 && tableData.rows.length > 0) {
      autoTable(pdf, {
        head: [tableData.headers],
        body: tableData.rows,
        startY: yPosition,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 7,
          cellPadding: 1.5,
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 35 }, // Species column
        },
        theme: "grid",
        didParseCell: function (data) {
          // Make change columns more prominent if they show significant changes
          if (data.column.index >= tableData.headers.length - 2) {
            const cellText = data.cell.text[0];
            if (cellText && cellText.includes("%")) {
              const value = parseFloat(cellText.replace("%", ""));
              if (!isNaN(value)) {
                if (value > 10) {
                  data.cell.styles.textColor = [0, 128, 0]; // Green
                  data.cell.styles.fontStyle = "bold";
                } else if (value < -10) {
                  data.cell.styles.textColor = [255, 0, 0]; // Red
                  data.cell.styles.fontStyle = "bold";
                }
              }
            }
          }
        },
      });
    }
  }

  // Generate filename
  const filename = generateFilename(selectedYears, targetTransect, targetSection);

  // Save PDF
  pdf.save(filename);
}

function extractTableData(tableElement: Element): {
  headers: string[];
  rows: string[][];
} {
  const headers: string[] = [];
  const rows: string[][] = [];

  // Extract headers
  const headerCells = tableElement.querySelectorAll("thead th");
  headerCells.forEach(cell => {
    // Check for data-content-for-pdf attribute
    const pdfContentElement = cell.querySelector("[data-content-for-pdf]");
    if (pdfContentElement) {
      headers.push(pdfContentElement.getAttribute("data-content-for-pdf") || "");
    } else {
      headers.push(cell.textContent?.trim() || "");
    }
  });

  // Extract rows
  const bodyRows = tableElement.querySelectorAll("tbody tr");
  bodyRows.forEach(row => {
    const rowData: string[] = [];
    const cells = row.querySelectorAll("td");

    cells.forEach(cell => {
      // Check for data-content-for-pdf attribute
      const pdfContentElement = cell.querySelector("[data-content-for-pdf]");
      if (pdfContentElement) {
        rowData.push(pdfContentElement.getAttribute("data-content-for-pdf") || "");
      } else {
        rowData.push(cell.textContent?.trim() || "");
      }
    });

    if (rowData.length > 0) {
      rows.push(rowData);
    }
  });

  return { headers, rows };
}

function generateFilename(
  years: number[],
  transect: string | null,
  section: string | null
): string {
  const date = new Date().toISOString().split("T")[0];
  const yearsPart = years.join("-");
  const transectPart = transect ? `-${transect}` : "";
  const sectionPart = section ? `-${section}` : "";

  return `BMS-Report-${yearsPart}${transectPart}${sectionPart}-${date}.pdf`;
}
