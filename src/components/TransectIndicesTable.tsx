import React, { useMemo, useState } from "react";
import { Table, Alert, Checkbox, Space, Switch } from "antd";
import type { ColumnsType } from "antd/es/table";

interface TransectIndicesTableProps {
  speciesName: string;
  flightCurvesData: any;
  transectData: any;
}

interface TransectIndexRow {
  key: string;
  transectId: string;
  transectName: string;
  [year: string]: string | number; // Dynamic year columns
}

const TransectIndicesTable: React.FC<TransectIndicesTableProps> = ({
  speciesName,
  flightCurvesData,
  transectData,
}) => {
  const [hideZeroRows, setHideZeroRows] = useState(false);
  const [showRawCounts, setShowRawCounts] = useState(false);

  const tableData = useMemo(() => {
    // Get site indices or raw counts for this species
    const speciesData = flightCurvesData?.species?.[speciesName];
    const siteIndices = showRawCounts ? speciesData?.site_raw_counts : speciesData?.site_indices;

    if (!siteIndices || !transectData?.transects) {
      return { data: [], years: [] };
    }

    // Create a map of transect IDs to names
    const transectMap = new Map(
      transectData.transects.map((t: any) => [t.transectId, t.transectName])
    );

    // Collect all years
    const yearsSet = new Set<number>();
    Object.values(siteIndices).forEach((indices: any) => {
      Object.keys(indices).forEach(year => yearsSet.add(parseInt(year)));
    });
    const years = Array.from(yearsSet).sort();

    // Build table data
    const data: TransectIndexRow[] = Object.entries(siteIndices).map(
      ([transectId, indices]: [string, any]) => {
        const row: any = {
          key: transectId,
          transectId,
          transectName: transectMap.get(transectId) || transectId,
        };

        // Add year columns
        years.forEach(year => {
          const index = indices[year.toString()];
          row[year.toString()] = index !== undefined && index !== null ? index : "-";
        });

        return row as TransectIndexRow;
      }
    );

    // Sort by transect name
    data.sort((a, b) => a.transectName.localeCompare(b.transectName));

    // Filter out rows with all zeros/missing values if requested
    let filteredData = data;
    if (hideZeroRows) {
      filteredData = data.filter(row => {
        // Check if at least one year has a non-zero value
        return years.some(year => {
          const value = row[year.toString()];
          return value !== "-" && typeof value === "number" && value !== 0;
        });
      });
    }

    return { data: filteredData, years, totalRows: data.length };
  }, [speciesName, flightCurvesData, transectData, hideZeroRows, showRawCounts]);

  if (tableData.data.length === 0) {
    return (
      <Alert
        message="Índices de transecto não disponíveis"
        description="Dados insuficientes para calcular índices por transecto para esta espécie."
        type="info"
        showIcon
      />
    );
  }

  // Build columns: Transect name + year columns
  const columns: ColumnsType<TransectIndexRow> = [
    {
      title: "Transecto",
      dataIndex: "transectName",
      key: "transectName",
      fixed: "left",
      width: 250,
      sorter: (a, b) => a.transectName.localeCompare(b.transectName),
    },
    ...tableData.years.map(year => ({
      title: year.toString(),
      dataIndex: year.toString(),
      key: year.toString(),
      width: 100,
      align: "right" as const,
      render: (value: number | string) => {
        if (value === "-") {
          return <span style={{ color: "#d9d9d9" }}>-</span>;
        }
        return (
          <span style={{ fontFamily: "monospace" }}>
            {typeof value === "number"
              ? showRawCounts
                ? Math.round(value).toString()
                : value.toFixed(1)
              : value}
          </span>
        );
      },
      sorter: (a: TransectIndexRow, b: TransectIndexRow) => {
        const aVal = a[year.toString()];
        const bVal = b[year.toString()];

        // Treat "-" as less than zero (-Infinity for sorting purposes)
        const aNum = aVal === "-" ? -Infinity : (aVal as number);
        const bNum = bVal === "-" ? -Infinity : (bVal as number);

        return aNum - bNum;
      },
    })),
  ];

  return (
    <div>
      <Alert
        message={
          showRawCounts
            ? "Contagens Brutas por Transecto"
            : "Índices de Abundância por Transecto"
        }
        description={
          showRawCounts ? (
            <p>
              Esta tabela mostra o número total de indivíduos de <strong>{speciesName}</strong>{" "}
              contados em cada transecto durante a época de monitorização (Março-Setembro) de cada
              ano.
            </p>
          ) : (
            <>
              <p>
                Esta tabela mostra os índices anuais de abundância calculados pelo método rbms
                para cada transecto. Os valores são normalizados para transectos de 1 km de
                comprimento e representam a abundância estimada de <strong>{speciesName}</strong>{" "}
                por ano.
              </p>
              <p style={{ marginTop: 8, marginBottom: 0 }}>
                <strong>Nota:</strong> Os índices são expressos relativamente ao ano baseline
                (definido como 100). Valores superiores a 100 indicam maior abundância que o
                baseline, valores inferiores indicam menor abundância.
              </p>
            </>
          )
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Space style={{ marginBottom: 16 }}>
        <Checkbox checked={hideZeroRows} onChange={e => setHideZeroRows(e.target.checked)}>
          Ocultar transectos sem dados (apenas zeros)
        </Checkbox>
        {hideZeroRows &&
          tableData.totalRows !== undefined &&
          tableData.totalRows > tableData.data.length && (
            <span style={{ color: "#8c8c8c", fontSize: 13 }}>
              ({tableData.totalRows - tableData.data.length} transectos ocultos)
            </span>
          )}
        <Switch
          checked={showRawCounts}
          onChange={setShowRawCounts}
          checkedChildren="Contagens"
          unCheckedChildren="Índices"
          style={{ marginLeft: 16 }}
        />
        <span style={{ fontSize: 13, color: "#595959" }}>
          {showRawCounts ? "A mostrar contagens brutas" : "A mostrar índices calculados"}
        </span>
      </Space>

      <Table
        columns={columns}
        dataSource={tableData.data}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} de ${total} transectos`,
        }}
        scroll={{ x: "max-content" }}
        size="small"
        bordered
      />
    </div>
  );
};

export default TransectIndicesTable;
