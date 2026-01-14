/**
 * Glue Logic for Ranuts/Document (Ported to Vanilla JS)
 */

window.RanutsGlue = (function () {

    // --- mock i18n ---
    const t = (key) => key; // Mock translation
    const getOnlyOfficeLang = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('locale') === 'zh' ? 'zh-CN' : 'en-US';
    };

    // --- document-types ---
    const oAscFileType = {
        xlsx: 'cell', xls: 'cell', csv: 'cell',
        pptx: 'slide', ppt: 'slide', odp: 'slide',
        docx: 'word', doc: 'word', odt: 'word', txt: 'word', rtf: 'word', pdf: 'word'
    };
    const c_oAscFileType2 = {
        'docx': 'docx', 'doc': 'doc', 'odt': 'odt', 'txt': 'txt', 'rtf': 'rtf', 'pdf': 'pdf',
        'xlsx': 'xlsx', 'xls': 'xls', 'ods': 'ods', 'csv': 'csv',
        'pptx': 'pptx', 'ppt': 'ppt', 'odp': 'odp'
    };

    // --- document-utils ---
    const BASE_PATH = '/office/';
    const DOCUMENT_TYPE_MAP = {};
    Object.keys(oAscFileType).forEach(ext => {
        DOCUMENT_TYPE_MAP[ext] = oAscFileType[ext];
    });

    const getDocumentType = (ext) => DOCUMENT_TYPE_MAP[ext.toLowerCase()] || 'word';

    const getExtensions = (mime) => {
        // Simplified mime mapping
        if (mime.includes('word')) return ['docx'];
        if (mime.includes('sheet')) return ['xlsx'];
        if (mime.includes('presentation')) return ['pptx'];
        return [];
    };

    function createObjectURL(blob) {
        return URL.createObjectURL(blob);
    }

    function scriptOnLoad(urls) {
        return Promise.all(urls.map(url => new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        })));
    }

    // --- empty_bin (Simplified) ---
    // We can load empty.bin from server if needed, or base64. 
    // ranuts used a huge JS file. For now let's assume we always open existing files or handle new later.
    const g_sEmpty_bin = {};

    // --- document-converter (X2TConverter) ---
    class X2TConverter {
        constructor() {
            this.x2tModule = null;
            this.isReady = false;
            this.initPromise = null;
            this.WORKING_DIRS = ['/working', '/working/media', '/working/fonts', '/working/themes'];
            this.SCRIPT_PATH = `${BASE_PATH}wasm/x2t/x2t.js`;
        }

        async initialize() {
            if (this.isReady && this.x2tModule) return this.x2tModule;
            if (this.initPromise) return this.initPromise;

            this.initPromise = (async () => {
                await scriptOnLoad([this.SCRIPT_PATH]);
                return new Promise((resolve, reject) => {
                    const x2t = window.Module;
                    if (!x2t) return reject(new Error('X2T module not found'));

                    x2t.onRuntimeInitialized = () => {
                        this.createWorkingDirectories(x2t);
                        this.x2tModule = x2t;
                        this.isReady = true;
                        console.log('X2T initialized');
                        resolve(x2t);
                    };
                });
            })();
            return this.initPromise;
        }

        createWorkingDirectories(x2t) {
            this.WORKING_DIRS.forEach(dir => {
                try { x2t.FS.mkdir(dir); } catch (e) { }
            });
        }

        sanitizeFileName(input) {
            if (!input) return 'file.bin';
            const parts = input.split('.');
            const ext = parts.pop() || 'bin';
            const name = parts.join('.');
            // simple sanitize
            return name.replace(/[^a-zA-Z0-9]/g, '_') + '.' + ext;
        }

        createConversionParams(from, to, extra = '') {
            return `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFileFrom>${from}</m_sFileFrom>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileTo>${to}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  ${extra}
</TaskQueueDataConvert>`;
        }

        async convertDocument(file) {
            await this.initialize();
            const fileName = file.name;
            const fileExt = fileName.split('.').pop().toLowerCase();
            const documentType = getDocumentType(fileExt);

            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);

            // Note: Skipping CSV special handling for brevity (assuming DOCX mostly)

            const sanitizedName = this.sanitizeFileName(fileName);
            const inputPath = `/working/${sanitizedName}`;
            const outputPath = `${inputPath}.bin`;

            this.x2tModule.FS.writeFile(inputPath, data);

            const params = this.createConversionParams(inputPath, outputPath);
            this.x2tModule.FS.writeFile('/working/params.xml', params);

            const res = this.x2tModule.ccall('main1', 'number', ['string'], ['/working/params.xml']);
            if (res !== 0) throw new Error('Conversion failed code: ' + res);

            const result = this.x2tModule.FS.readFile(outputPath);
            // Media reading skipped for now
            const media = {};

            return {
                fileName: sanitizedName,
                type: documentType,
                bin: result,
                media
            };
        }

        async convertBinToDocument(bin, originalFileName, targetExt = 'DOCX') {
            await this.initialize();
            const sanitizedBase = this.sanitizeFileName(originalFileName).replace(/\.[^/.]+$/, '');
            const binFileName = `${sanitizedBase}.bin`;
            const outputFileName = `${sanitizedBase}.${targetExt.toLowerCase()}`;

            this.x2tModule.FS.writeFile(`/working/${binFileName}`, bin);
            const params = this.createConversionParams(`/working/${binFileName}`, `/working/${outputFileName}`);
            this.x2tModule.FS.writeFile('/working/params.xml', params);

            const res = this.x2tModule.ccall('main1', 'number', ['string'], ['/working/params.xml']);
            if (res !== 0) throw new Error('Conversion failed code: ' + res);

            const result = this.x2tModule.FS.readFile(`/working/${outputFileName}`);
            return { fileName: outputFileName, data: result };
        }
    }

    const x2tConverter = new X2TConverter();

    // --- onlyoffice-editor (Simplified) ---
    async function createEditorInstance(config) {
        const { fileName, fileType, binData, media } = config;

        if (window.editor) {
            window.editor.destroyEditor();
            window.editor = null;
        }

        const editorLang = getOnlyOfficeLang();

        if (!window.DocsAPI) {
            // Ensure API loaded
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = './web-apps/apps/api/documents/api.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        }

        window.editor = new window.DocsAPI.DocEditor('iframe', {
            document: {
                title: fileName,
                url: fileName,
                fileType: fileType,
                permissions: { edit: true, chat: false, protect: false }
            },
            editorConfig: {
                lang: editorLang,
                mode: 'edit',
                user: { id: 'uid', name: 'User' },
                customization: {
                    autosave: true, forceSave: true,
                    features: { spellcheck: { change: false } }
                }
            },
            events: {
                onAppReady: () => {
                    console.log("App ready");
                    if (media) {
                        window.editor.sendCommand({
                            command: 'asc_setImageUrls',
                            data: { urls: media }
                        });
                    }
                    window.editor.sendCommand({
                        command: 'asc_openDocument',
                        data: { buf: binData }
                    });
                },
                onSave: handleSaveDocument
            }
        });
    }

    async function handleSaveDocument(event) {
        console.log('Save document event:', event);
        if (event.data && event.data.data) {
            const { data, option } = event.data;
            // Defaulting to DOCX if not specified
            const targetExt = c_oAscFileType2[option.outputformat] || 'docx';
            // Convert BIN to DOCX
            const result = await x2tConverter.convertBinToDocument(data.data, window.currentFileName || 'doc.docx', targetExt);

            // Convert result to Base64
            const blob = new Blob([result.data]);
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = function () {
                const base64data = reader.result;
                // Send to parent
                window.parent.postMessage({
                    type: 'FILE_SAVED',
                    base64: base64data,
                    fileName: result.fileName
                }, '*');
            }

            window.editor.sendCommand({
                command: 'asc_onSaveCallback',
                data: { err_code: 0 }
            });
        }
    }

    // --- Message Listener for External Commands ---
    window.addEventListener('message', function (msg) {
        if (msg.data && msg.data.type === 'INSERT_IMAGE') {
            const { base64, width, height } = msg.data;
            if (window.editor) {
                console.log("Attempting Signature Insertion with Blob URL strategy...");

                // Convert Base64 to Blob URL to avoid length limits or parser issues
                try {
                    const byteString = atob(base64.split(',')[1]);
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: 'image/png' });
                    const blobUrl = URL.createObjectURL(blob);
                    console.log("Created Blob URL:", blobUrl);

                    const imgHtml = `<img src="${blobUrl}" />`;

                    // Strategy 1: Standard insertImage with Blob URL
                    if (typeof window.editor.insertImage === 'function') {
                        console.log("Trying: window.editor.insertImage(blobUrl)");
                        window.editor.insertImage(blobUrl);
                    }

                    // Strategy 2: PasteHtml via `pasteHtml` command
                    console.log("Trying: sendCommand('pasteHtml')");
                    // Note: 'pasteHtml' might be the command name for the internal API
                    window.editor.sendCommand({
                        command: 'pasteHtml',
                        data: imgHtml
                    });

                    // Strategy 3: PasteHtml via serviceCommand
                    if (window.editor.serviceCommand) {
                        console.log("Trying: serviceCommand('pasteHtml')");
                        window.editor.serviceCommand('pasteHtml', imgHtml);
                    }

                    // Strategy 4: Internal asc_pasteHtml (common in Ascensio builds)
                    console.log("Trying: sendCommand('asc_pasteHtml')");
                    window.editor.sendCommand({
                        command: 'asc_pasteHtml',
                        data: imgHtml
                    });

                } catch (e) {
                    console.error("Error preparing signature:", e);
                }
            } else {
                console.warn("Editor not ready");
            }
        }
    });

    // --- Main init function ---
    async function init(fileUrl, fileName) {
        try {
            window.currentFileName = fileName;

            // Load file
            const response = await fetch(fileUrl);
            if (!response.ok) throw new Error('Fetch failed: ' + response.status);
            const blob = await response.blob();
            const file = new File([blob], fileName, { type: blob.type });

            // Convert
            const { bin, type, media } = await x2tConverter.convertDocument(file);

            // Init Editor
            await createEditorInstance({
                fileName: fileName,
                fileType: fileName.split('.').pop(),
                binData: bin,
                media: media
            });
        } catch (error) {
            console.error("Glue Init Error:", error);
            // Send error to parent window (IntegratedFileViewer)
            window.parent.postMessage({
                type: 'FILE_LOAD_ERROR',
                message: error.message,
                code: error.message && error.message.includes('code:') ? error.message.split('code:')[1].trim() : 'UNKNOWN'
            }, '*');
        }
    }

    return { init };

})();
