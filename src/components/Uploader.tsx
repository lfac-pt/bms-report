import { parse, ParseResult } from "papaparse";
import { Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { ButterflyRecord } from "../types/dataset";

const { Dragger } = Upload;

interface UploaderProps {
  onUpload: (results: ParseResult<ButterflyRecord>) => void;
}

function Uploader({ onUpload }: UploaderProps) {
  const props = {
    name: "file",
    accept: "csv",
    multiple: false,
    action: "",
    maxCount: 1,
    showUploadList: false,
    customRequest({ file }: { file: any }) {
      parse<ButterflyRecord>(file, {
        download: true,
        complete: onUpload,
        header: true,
        dynamicTyping: true,
      });
    },
  };

  return (
    <Dragger {...props}>
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">Clique ou arraste ficheiros para esta área para começar</p>
      <p className="ant-upload-hint">
        Exporte o ficheiro na plataform butterfly-monitoring.net usando a opção &quot;Download
        species ocurrences from transects (zipped CSV)&quot;. Ficheiros são só lidos localmente.
      </p>
    </Dragger>
  );
}

export default Uploader;
