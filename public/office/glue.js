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
                // Pre-define Module to control loading behavior
                window.Module = {
                    locateFile: (path) => {
                        if (path.endsWith('.wasm')) return `${BASE_PATH}wasm/x2t/x2t.wasm`;
                        return `${BASE_PATH}wasm/x2t/${path}`;
                    },
                    print: (text) => console.log('[X2T stdout]:', text),
                    printErr: (text) => console.error('[X2T stderr]:', text),
                    onRuntimeInitialized: () => {
                        console.log('X2T Runtime Initialized (Callback)');
                    }
                };

                // Retry logic for script loading
                let retries = 3;
                while (retries > 0) {
                    try {
                        await scriptOnLoad([this.SCRIPT_PATH]);
                        break;
                    } catch (e) {
                        retries--;
                        console.warn(`Failed to load x2t.js, retrying... (${retries} left)`);
                        if (retries === 0) throw e;
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                return new Promise((resolve, reject) => {
                    const checkForModule = () => {
                        if (window.Module && window.Module.isReady) { // Assuming isReady or checking FS
                            const x2t = window.Module;
                            this.createWorkingDirectories(x2t);
                            this.x2tModule = x2t;
                            this.isReady = true;
                            // Load essential fonts before resolving
                            this.loadEssentialFonts().then(() => {
                                console.log('X2T fully ready with fonts');
                                resolve(x2t);
                                // Load remaining fonts in background
                                this.loadRemainingFontsInBackground();
                            });
                        } else if (window.Module && window.Module.onRuntimeInitialized) {
                            // Hook existing if not yet fired? 
                            // Actually, since we defined it, the callback above 'onRuntimeInitialized' will fire.
                            // We can wrap the resolve there.
                            const originalOnRuntimeInitialized = window.Module.onRuntimeInitialized;
                            window.Module.onRuntimeInitialized = () => {
                                if (originalOnRuntimeInitialized) originalOnRuntimeInitialized();
                                const x2t = window.Module;
                                this.createWorkingDirectories(x2t);
                                this.x2tModule = x2t;
                                this.isReady = true;
                                // Load essential fonts before resolving
                                this.loadEssentialFonts().then(() => {
                                    console.log('X2T fully ready with fonts (from hook)');
                                    resolve(x2t);
                                    // Load remaining fonts in background
                                    this.loadRemainingFontsInBackground();
                                });
                            };
                        } else {
                            // Fallback polling if callbacks missed (rare)
                            setTimeout(checkForModule, 100);
                        }
                    };

                    // Allow small delay for script to process Module definition
                    setTimeout(checkForModule, 50);
                });
            })();
            return this.initPromise;
        }

        createWorkingDirectories(x2t) {
            this.WORKING_DIRS.forEach(dir => {
                try { x2t.FS.mkdir(dir); } catch (e) { }
            });
        }

        // Priority 1: Essential fonts for immediate rendering
        getEssentialFonts() {
            return [
                'LiberationSans-Regular.ttf',
                'LiberationSans-Bold.ttf'
            ];
        }

        // Priority 2+3: Remaining fonts for background loading
        getRemainingFonts() {
            return [
                'LiberationSans-Italic.ttf',
                'LiberationSans-BoldItalic.ttf',
                'DejaVuSans.ttf',
                'DejaVuSans-Bold.ttf',
                'DejaVuSans-Oblique.ttf',
                'DejaVuSans-BoldOblique.ttf',
                'DejaVuSansMono.ttf',
                'DejaVuSansMono-Bold.ttf',
                'DejaVuSansMono-Oblique.ttf',
                'DejaVuSansMono-BoldOblique.ttf',
                'ComicNeue-Regular.ttf',
                'ComicNeue-Bold.ttf',
                'ComicNeue-Italic.ttf',
                'ComicNeue-BoldItalic.ttf'
            ];
        }

        async loadFont(fontName) {
            try {
                const response = await fetch(`${BASE_PATH}fonts/${fontName}`);
                if (!response.ok) throw new Error(`Failed to load ${fontName}`);
                const buffer = await response.arrayBuffer();
                const data = new Uint8Array(buffer);
                this.x2tModule.FS.writeFile(`/working/fonts/${fontName}`, data);
                console.log(`[Font] Loaded: ${fontName}`);
                return true;
            } catch (e) {
                console.warn(`[Font] Failed to load: ${fontName}`, e.message);
                return false;
            }
        }

        async loadEssentialFonts() {
            console.log('[Fonts] Loading essential fonts...');
            const fonts = this.getEssentialFonts();
            await Promise.all(fonts.map(f => this.loadFont(f)));
            console.log('[Fonts] Essential fonts loaded');
        }

        loadRemainingFontsInBackground() {
            console.log('[Fonts] Starting background font loading...');
            const fonts = this.getRemainingFonts();
            // Load one by one silently in background
            fonts.reduce((promise, font) => {
                return promise.then(() => this.loadFont(font));
            }, Promise.resolve()).then(() => {
                console.log('[Fonts] All background fonts loaded');
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

        getFormatId(filename) {
            const ext = filename.split('.').pop().toLowerCase();
            switch (ext) {
                case 'bin': return 8192; // Internal format for loading (unused if 0 is used)
                case 'docx': return 65;
                case 'doc': return 65;
                case 'xlsx': return 257;
                case 'xls': return 257;
                case 'pptx': return 129;
                case 'ppt': return 129;
                case 'pdf': return 513;
                default: return 65;
            }
        }

        // Get canvas format ID for the internal binary format based on document type
        getCanvasFormatId(targetExt) {
            const ext = targetExt.toLowerCase();
            switch (ext) {
                case 'docx':
                case 'doc':
                    return 2050; // AVS_OFFICESTUDIO_FILE_CANVAS_WORD
                case 'xlsx':
                case 'xls':
                    return 2051; // AVS_OFFICESTUDIO_FILE_CANVAS_SPREADSHEET
                case 'pptx':
                case 'ppt':
                    return 2052; // AVS_OFFICESTUDIO_FILE_CANVAS_PRESENTATION
                default:
                    return 2050; // Default to word
            }
        }

        createConversionParams(from, to, extra = '') {
            const fromExt = from.split('.').pop().toLowerCase();
            const toExt = to.split('.').pop().toLowerCase();
            // Use 0 (auto-detect) for all formats, including .bin
            const formatFrom = 0;
            const formatTo = this.getFormatId(to);

            console.log(`[Glue] Creating params: ${from} -> ${to}, Format: ${formatFrom} -> ${formatTo}`);

            return `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFileFrom>${from}</m_sFileFrom>
  <m_sFileTo>${to}</m_sFileTo>
  <m_sFontDir>/working/fonts</m_sFontDir>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_bIsNoBase64>false</m_bIsNoBase64>
  <m_nFormatFrom>${formatFrom}</m_nFormatFrom>
  <m_nFormatTo>${formatTo}</m_nFormatTo>
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
        const { fileName, fileType, binData, media, mode = 'edit', canSave = true } = config;
        const isEditMode = mode === 'edit';
        console.log('[Editor] Creating instance, mode:', mode, 'canSave:', canSave);

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
                permissions: {
                    edit: isEditMode,
                    download: true,
                    print: true,
                    review: false,
                    chat: false,
                    protect: false
                }
            },
            editorConfig: {
                lang: editorLang,
                mode: isEditMode ? 'edit' : 'view',
                user: { id: 'uid', name: 'User' },
                customization: {
                    autosave: false, // Disable autosave to force manual save events
                    forceSave: true, // Force the save button to be visible/active
                    features: { spellcheck: { change: false } },
                    toolbarNoTabs: !isEditMode,
                    compactHeader: !isEditMode
                }
            },
            events: {
                onAppReady: () => {
                    console.log("App ready in", isEditMode ? 'EDIT' : 'VIEW', "mode");
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
                onSave: isEditMode ? handleSaveDocument : undefined,
                onRequestInsertImage: isEditMode ? handleInsertImageRequest : undefined
            }
        });
    }

    function handleInsertImageRequest(event) {
        console.log('[Glue] onRequestInsertImage triggered');

        // Create a hidden file input to mimic "From File"
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png, image/jpeg, image/jpg, image/gif, image/svg+xml';

        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (loadEvent) {
                const url = loadEvent.target.result; // Base64 or Blob URL? FileReader.readAsDataURL gives Base64

                // OnlyOffice insertImage expects an array of objects
                const images = [
                    {
                        "fileType": file.name.split('.').pop().toLowerCase(),
                        "url": url
                    }
                ];

                if (window.editor && window.editor.insertImage) {
                    window.editor.insertImage(images);
                } else {
                    // Fallback using commands if insertImage method is missing (older APIs)
                    window.editor.sendCommand({
                        command: 'asc_setImageUrls', // OR asc_insertImage
                        data: { urls: [url] }
                    });
                    // try direct command
                    const imgHtml = `<img src="${url}" />`;
                    window.editor.sendCommand({
                        command: 'pasteHtml',
                        data: imgHtml
                    });
                }
            };
            reader.readAsDataURL(file);
        };

        input.click();
    }

    // Flag to prevent concurrent saves
    let isSaving = false;

    async function handleSaveDocument(event) {
        if (isSaving) {
            console.log('[Glue] Save already in progress, skipping...');
            return;
        }

        isSaving = true;
        console.log('Save document event:', event);

        // Check if user can save
        if (!window.canSave) {
            // Not allowed to save - send message to parent to show toast
            window.parent.postMessage({
                type: 'SAVE_NOT_ALLOWED',
                message: 'Bạn không phải là tác giả của file, vui lòng liên hệ tác giả để yêu cầu chỉnh sửa.'
            }, '*');
            console.log('[Save] Blocked - user is not the author');
            // Dismiss the "Saving document" dialog
            if (window.editor) {
                window.editor.sendCommand({
                    command: 'asc_onSaveCallback',
                    data: { err_code: 0 }
                });
            }
            isSaving = false;
            return;
        }

        try {
            if (event.data && event.data.data) {
                const { data, option } = event.data;
                // Defaulting to DOCX if not specified
                const targetExt = c_oAscFileType2[option.outputformat] || 'docx';
                console.log(`[Glue] handling save. Data size: ${data.data ? data.data.length : 'undefined'}, Target: ${targetExt}`);

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
                    isSaving = false;
                }

                // Note: We don't set isSaving=false here because it's set in the onloadend callback
                // Wait, if onloadend fails or isn't called, isSaving might get stuck?
                // FileReader is reliable, but to be safe we can wrap it in a Promise.

                window.editor.sendCommand({
                    command: 'asc_onSaveCallback', // Manually notify editor that save is done
                    data: { err_code: 0 }
                });
            } else {
                isSaving = false;
            }
        } catch (error) {
            console.error('[Glue] Save error:', error);
            window.parent.postMessage({
                type: 'SAVE_ERROR',
                message: error.message || 'Unknown error saving file'
            }, '*');

            // Notify editor of failure so it doesn't spin forever
            if (window.editor) {
                window.editor.sendCommand({
                    command: 'asc_onSaveCallback',
                    data: { err_code: 88 } // Generic error code
                });
            }
            isSaving = false;
        }
    }


    // --- Message Listener for ONLYOFFICE Gateway events (onSave, etc.) ---
    window.addEventListener('message', async function (msg) {
        // Handle ONLYOFFICE Gateway onSave or onRequestSave event
        if (msg.data && (msg.data.event === 'onSave' || msg.data.event === 'onRequestSave')) {
            // Check if user can save
            if (!window.canSave) {
                window.parent.postMessage({
                    type: 'SAVE_NOT_ALLOWED',
                    message: 'Bạn không phải là tác giả của file, vui lòng liên hệ tác giả để yêu cầu chỉnh sửa.'
                }, '*');
                return;
            }

            try {
                const saveData = msg.data.data;
                if (saveData && saveData.data) {
                    // The data from ONLYOFFICE is the internal .bin format
                    // We need to convert it back to DOCX/XLSX/PPTX
                    const binData = saveData.data.data ? new Uint8Array(saveData.data.data) : saveData.data;

                    // Determine output format based on original file
                    const originalExt = (window.currentFileName || 'doc.docx').split('.').pop().toLowerCase();
                    let targetExt = 'docx';
                    if (['xlsx', 'xls', 'csv'].includes(originalExt)) targetExt = 'xlsx';
                    else if (['pptx', 'ppt', 'odp'].includes(originalExt)) targetExt = 'pptx';

                    // Convert bin back to document format
                    const result = await x2tConverter.convertBinToDocument(
                        binData,
                        window.currentFileName || 'document.docx',
                        targetExt
                    );

                    // Convert to base64 and send to parent
                    const blob = new Blob([result.data]);
                    const reader = new FileReader();
                    reader.onloadend = function () {
                        const base64data = reader.result;
                        window.parent.postMessage({
                            type: 'FILE_SAVED',
                            base64: base64data,
                            fileName: result.fileName
                        }, '*');
                    };
                    reader.readAsDataURL(blob);
                }
            } catch (error) {
                console.error('[Glue] Save conversion error:', error);
                window.parent.postMessage({
                    type: 'SAVE_ERROR',
                    message: error.message
                }, '*');
            }
            return;
        }

        // Handle INSERT_IMAGE command from parent
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
                console.warn("[Glue] Editor not ready");
            }
        }


    });

    // --- Paste Handler for Images ---
    window.addEventListener('paste', function (e) {
        if (!e.clipboardData) return;

        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (!blob) continue;

                console.log('[Glue] Image paste detected');
                const reader = new FileReader();
                reader.onload = function (event) {
                    const base64 = event.target.result;
                    if (window.editor && window.editor.insertImage) {
                        window.editor.insertImage([
                            {
                                "fileType": blob.type.split('/')[1] || 'png',
                                "url": base64
                            }
                        ]);
                    }
                };
                reader.readAsDataURL(blob);

                // Prevent default standard paste to avoid double insertion or failure
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
    }, true);

    // --- Main init function ---
    async function init(fileUrl, fileName, mode = 'edit', canSave = true) {
        try {
            window.currentFileName = fileName;
            window.currentMode = mode;
            window.canSave = canSave;
            console.log('[Glue] Mode:', mode, 'CanSave:', canSave);

            // Load file
            console.log("Fetching file from:", fileUrl);
            const response = await fetch(fileUrl, {
                method: 'GET',
                cache: 'no-cache',
                credentials: 'omit'
            });
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
                media: media,
                mode: mode,
                canSave: canSave
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
