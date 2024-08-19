import { parse } from 'papaparse';
import { Upload } from "antd";
import { InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

function Uploader({ onUpload }) {
    const props = {
        name: 'file',
        accept: "csv",
        multiple: false,
        action: '',
        maxCount: 1,
        showUploadList: false,
        customRequest({ file }) {
            parse(file, {
                download: true,
                complete: onUpload,
                header: true,
                dynamicTyping: true
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
                Exporte o ficheiro na plataform butterfly-monitoring.net usando a opção "Download species ocurrences from transects (zipped CSV)". Ficheiros são só lidos localmente.
            </p>
        </Dragger>
    );
}

export default Uploader;
