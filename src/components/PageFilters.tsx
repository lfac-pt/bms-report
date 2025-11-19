import { useState } from "react";
import { Select, Button, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { exportToPDF } from "../utils/pdfExport";
import { DatasetType } from "../utils/datasetAdapter";
import { Dataset } from "../types/dataset";

interface PageFiltersProps {
  yearsList: number[];
  selectedYears: number[];
  transectsList: string[];
  transectNames: Record<string, string>;
  targetTransect: string | null;
  targetTransectName: string | null;
  onSelectedYearsChange: (years: number[]) => void;
  onTargetTransectChange: (transect: string) => void;
  sectionsList: string[];
  targetSection: string | null;
  onTargetSectionChange: (section: string | null) => void;
  datasetType: DatasetType;
  dataset: Dataset;
}

function PageFilters({
  yearsList,
  selectedYears,
  transectsList,
  transectNames,
  targetTransect,
  targetTransectName,
  onSelectedYearsChange,
  onTargetTransectChange,
  sectionsList,
  targetSection,
  onTargetSectionChange,
  datasetType,
  dataset,
}: PageFiltersProps) {
  const yearOptions = yearsList.map(year => {
    return {
      value: year,
      label: <span>{year}</span>,
    };
  });

  // Count records per transect
  const transectRecordCounts: Record<string, number> = {};
  dataset.forEach(entry => {
    const transectId = entry["Transect ID"];
    transectRecordCounts[transectId] = (transectRecordCounts[transectId] || 0) + 1;
  });

  const transectOptions = transectsList.map(transect => {
    const recordCount = transectRecordCounts[transect] || 0;
    const name = transectNames[transect] || transect;
    return {
      value: transect,
      label: (
        <span>
          {name} <span style={{ color: "#999", fontSize: "0.9em" }}>({recordCount})</span>
        </span>
      ),
    };
  });

  const sectionOptions = sectionsList.map(section => {
    return {
      value: section,
      label: <span>{section}</span>,
    };
  });

  const [isExporting, setIsExporting] = useState(false);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF({
        selectedYears,
        targetTransect,
        targetSection,
        targetTransectName,
        datasetType,
      });
      message.success("PDF exportado com sucesso!");
    } catch (_error) {
      message.error("Erro ao exportar PDF. Por favor, tente novamente.");
      // eslint-disable-next-line
      console.error(_error);
    } finally {
      setIsExporting(false);
    }
  };

  const transectLabel = datasetType === "nocturnal" ? "Estação" : "Transecto";

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Select
          mode="multiple"
          options={yearOptions}
          value={selectedYears}
          onChange={onSelectedYearsChange}
          style={{ minWidth: 200 }}
          placeholder="Selecione anos"
        />
        <Select
          options={transectOptions}
          value={targetTransect}
          onChange={onTargetTransectChange}
          placeholder={`Selecione ${transectLabel.toLowerCase()}`}
          style={{ minWidth: 450 }}
        />
        {datasetType === "diurnal" && (
          <Select
            options={sectionOptions}
            value={targetSection}
            onChange={onTargetSectionChange}
            style={
              {
                /*width: '100%'*/
              }
            }
            allowClear
            placeholder="Todas as secções"
            optionFilterProp="value"
            filterSort={(optionA, optionB) =>
              (optionA.value ?? "")
                .toLowerCase()
                .localeCompare((optionB?.value ?? "").toLowerCase())
            }
          />
        )}
      </div>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        onClick={handleExportPDF}
        loading={isExporting}
      >
        Exportar para PDF
      </Button>
    </div>
  );
}

export default PageFilters;
