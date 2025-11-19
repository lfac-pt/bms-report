import { parse, ParseResult } from "papaparse";
import { Upload, List, Button } from "antd";
import { InboxOutlined, DeleteOutlined, FileTextOutlined } from "@ant-design/icons";
import { useState, useEffect, useRef } from "react";
import { ButterflyRecord } from "../types/dataset";
import { NocturnalButterflyRecord } from "../types/nocturnalDataset";
import { DatasetType } from "../utils/datasetAdapter";

const { Dragger } = Upload;

interface UploaderProps {
  onUpload: (
    results: ParseResult<ButterflyRecord | NocturnalButterflyRecord>,
    type: DatasetType
  ) => void;
  datasetType: DatasetType;
}

function Uploader({ onUpload, datasetType }: UploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<
    Map<string, ButterflyRecord[] | NocturnalButterflyRecord[]>
  >(() => new Map());

  // Store the latest callback and datasetType in refs to avoid re-triggering effect
  const onUploadRef = useRef(onUpload);
  const datasetTypeRef = useRef(datasetType);

  useEffect(() => {
    onUploadRef.current = onUpload;
    datasetTypeRef.current = datasetType;
  });

  // Merge and upload whenever uploadedFiles changes
  useEffect(() => {
    if (uploadedFiles.size > 0) {
      // Merge all file data into a single dataset
      const mergedData: (ButterflyRecord | NocturnalButterflyRecord)[] = [];
      uploadedFiles.forEach(data => {
        mergedData.push(...data);
      });

      // Create a ParseResult with the merged data
      const mergedResult: ParseResult<ButterflyRecord | NocturnalButterflyRecord> = {
        data: mergedData,
        errors: [],
        meta: {
          delimiter: ",",
          linebreak: "\n",
          aborted: false,
          truncated: false,
          cursor: 0,
        },
      };

      onUploadRef.current(mergedResult, datasetTypeRef.current);
    }
  }, [uploadedFiles]);

  const props = {
    name: "file",
    accept: ".csv",
    multiple: true,
    action: "",
    showUploadList: false,
    customRequest({ file, onSuccess }: { file: any; onSuccess?: (body: any) => void }) {
      if (datasetType === "nocturnal") {
        parse<NocturnalButterflyRecord>(file, {
          download: true,
          complete: results => {
            setUploadedFiles(prevFiles => {
              const newFiles = new Map(prevFiles);
              newFiles.set(file.name, results.data);
              return newFiles;
            });
            if (onSuccess) onSuccess("ok");
          },
          header: true,
          dynamicTyping: true,
        });
      } else {
        parse<ButterflyRecord>(file, {
          download: true,
          complete: results => {
            setUploadedFiles(prevFiles => {
              const newFiles = new Map(prevFiles);
              newFiles.set(file.name, results.data);
              return newFiles;
            });
            if (onSuccess) onSuccess("ok");
          },
          header: true,
          dynamicTyping: true,
        });
      }
    },
    onRemove(file: any) {
      setUploadedFiles(prevFiles => {
        const newFiles = new Map(prevFiles);
        newFiles.delete(file.name);
        return newFiles;
      });
    },
  };

  const fileNames = Array.from(uploadedFiles.keys());

  return (
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <Dragger {...props}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            Clique ou arraste um ou mais ficheiros para esta área para começar
          </p>
          <p className="ant-upload-hint">
            {datasetType === "diurnal" ? (
              <>
                Exporte o ficheiro na plataforma butterfly-monitoring.net usando a opção
                &quot;Download species occurrences from transects (zipped CSV)&quot;. Pode carregar
                múltiplos ficheiros que serão automaticamente combinados. Ficheiros são só lidos
                localmente.
              </>
            ) : (
              <>
                Exporte o ficheiro na plataforma butterfly-monitoring.net usando a opção
                &quot;Download moth trap occurrences&quot;. Pode carregar múltiplos ficheiros que
                serão automaticamente combinados. Ficheiros são só lidos localmente.
              </>
            )}
          </p>
        </Dragger>
      </div>
      {fileNames.length > 0 && (
        <div style={{ flex: 1, minWidth: "300px" }}>
          <List
            size="small"
            header={<div>Ficheiros carregados ({fileNames.length})</div>}
            bordered
            dataSource={fileNames}
            renderItem={fileName => (
              <List.Item
                actions={[
                  <Button
                    key="delete"
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      setUploadedFiles(prevFiles => {
                        const newFiles = new Map(prevFiles);
                        newFiles.delete(fileName);
                        return newFiles;
                      });
                    }}
                  />,
                ]}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined />}
                  title={fileName}
                  description={`${uploadedFiles.get(fileName)?.length || 0} registos`}
                />
              </List.Item>
            )}
          />
        </div>
      )}
    </div>
  );
}

export default Uploader;
