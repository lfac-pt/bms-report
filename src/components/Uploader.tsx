import { parse, ParseResult } from "papaparse";
import { Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { ButterflyRecord } from "../types/dataset";
import { NocturnalButterflyRecord } from "../types/nocturnalDataset";
import { DatasetType } from "../utils/datasetAdapter";

const { Dragger } = Upload;

interface UploaderProps {
  onUpload: (results: ParseResult<ButterflyRecord | NocturnalButterflyRecord>, type: DatasetType) => void;
  datasetType: DatasetType;
}

function Uploader({ onUpload, datasetType }: UploaderProps) {

  const props = {
    name: "file",
    accept: "csv",
    multiple: false,
    action: "",
    maxCount: 1,
    showUploadList: false,
    customRequest({ file }: { file: any }) {
      if (datasetType === "nocturnal") {
        parse<NocturnalButterflyRecord>(file, {
          download: true,
          complete: (results) => onUpload(results, "nocturnal"),
          header: true,
          dynamicTyping: true,
        });
      } else {
        parse<ButterflyRecord>(file, {
          download: true,
          complete: (results) => onUpload(results, "diurnal"),
          header: true,
          dynamicTyping: true,
        });
      }
    },
  };

  return (
    <Dragger {...props}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Clique ou arraste ficheiros para esta área para começar</p>
      <p className="ant-upload-hint">
        {datasetType === "diurnal" ? (
          <>
            Exporte o ficheiro na plataforma butterfly-monitoring.net usando a opção &quot;Download
            species occurrences from transects (zipped CSV)&quot;. Ficheiros são só lidos localmente.
          </>
        ) : (
          <>
            Exporte o ficheiro na plataforma butterfly-monitoring.net usando a opção &quot;Download moth trap occurrences&quot;. Ficheiros são só lidos localmente.
          </>
        )}
      </p>
    </Dragger>
  );
}

export default Uploader;
