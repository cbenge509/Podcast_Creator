document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('pdfUploadForm');
    const resultDiv = document.getElementById('result');
    const audioPlayer = document.getElementById('podcastAudio');
    const downloadLink = document.getElementById('downloadLink');
    const scriptText = document.getElementById('scriptText');
    const loadingDiv = document.getElementById('loading');
    const generationTimeP = document.getElementById('generationTime');
    const pdfInput = document.getElementById('pdfFile');
    const pdfViewer = document.getElementById('pdf-viewer');
    const previewSection = document.getElementById('preview-section');
    const hostVoiceSelect = document.getElementById('hostVoice');
    const guestVoiceSelect = document.getElementById('guestVoice');
    const generateButton = document.getElementById('generateButton');
    const parameterItems = document.querySelectorAll('.parameter-item');
    const podcastLengthSlider = document.getElementById('podcastLength');
    const podcastLengthValue = document.getElementById('podcastLengthValue');
    const outputLanguageSelect = document.getElementById('outputLanguage');

    let startTime;
    let allVoices = [];

    // Update podcast length value display
    podcastLengthSlider.addEventListener('input', function() {
        podcastLengthValue.textContent = this.value;
    });

    // Fetch available voices and populate dropdowns
    async function fetchAndPopulateVoices() {
        try {
            const response = await fetch('/get-voices');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            allVoices = await response.json();
            filterAndPopulateVoices();
        } catch (error) {
            console.error('Error fetching voices:', error);
            const errorMessage = 'Failed to load voices. Please refresh the page or try again later.';
            hostVoiceSelect.innerHTML = `<option value="">${errorMessage}</option>`;
            guestVoiceSelect.innerHTML = `<option value="">${errorMessage}</option>`;
        }
    }

    // Filter and populate voice dropdowns based on selected language
    function filterAndPopulateVoices() {
        const selectedLanguage = outputLanguageSelect.value;
        hostVoiceSelect.innerHTML = '';
        guestVoiceSelect.innerHTML = '';

        const filteredVoices = allVoices.filter(voice => voice.language_code === selectedLanguage);
        
        if (filteredVoices.length === 0) {
            const noVoicesMessage = `No voices available for ${selectedLanguage}`;
            hostVoiceSelect.innerHTML = `<option value="">${noVoicesMessage}</option>`;
            guestVoiceSelect.innerHTML = `<option value="">${noVoicesMessage}</option>`;
        } else {
            filteredVoices.forEach(voice => {
                const option = document.createElement('option');
                option.value = voice.name;
                option.textContent = `${voice.name} (${voice.gender})`;
                hostVoiceSelect.appendChild(option.cloneNode(true));
                guestVoiceSelect.appendChild(option);
            });
        }
    }

    // Call the function to fetch voices
    fetchAndPopulateVoices();

    // Add event listener for output language change
    outputLanguageSelect.addEventListener('change', filterAndPopulateVoices);

    // ... (rest of the code remains unchanged)

    // PDF preview functionality
    pdfInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file.type !== 'application/pdf') {
            console.error('Not a PDF file');
            return;
        }

        const fileReader = new FileReader();
        fileReader.onload = function() {
            const typedarray = new Uint8Array(this.result);

            pdfjsLib.getDocument(typedarray).promise.then(function(pdf) {
                // Clear previous content
                pdfViewer.innerHTML = '';

                // Show preview section
                previewSection.style.display = 'block';

                // Render all pages
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    pdf.getPage(pageNum).then(function(page) {
                        const viewport = page.getViewport({ scale: 1 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');

                        // Calculate scale to fit width
                        const scale = (pdfViewer.clientWidth - 20) / viewport.width; // 20px for padding
                        const scaledViewport = page.getViewport({ scale: scale });

                        canvas.height = scaledViewport.height;
                        canvas.width = scaledViewport.width;

                        const renderContext = {
                            canvasContext: context,
                            viewport: scaledViewport
                        };
                        page.render(renderContext);

                        pdfViewer.appendChild(canvas);
                    });
                }
            });
        };
        fileReader.readAsArrayBuffer(file);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        
        try {
            // Show loading indicator and hide result
            loadingDiv.style.display = 'flex';
            resultDiv.style.display = 'none';

            // Start timer
            startTime = Date.now();

            const response = await fetch('/generate-podcast', {
                method: 'POST',
                body: formData
            });
            // Hide document preview when generation is taking place
            previewSection.style.display = 'none';

            if (!response.ok) {
                throw new Error('Failed to generate podcast');
            }

            const data = await response.json();

            // Calculate generation time
            const endTime = Date.now();
            const generationTime = (endTime - startTime) / 1000; // Convert to seconds

            // Set audio source and download link
            audioPlayer.src = data.audioUrl;
            downloadLink.href = data.audioUrl;

            // Fetch and display the script content
            const scriptResponse = await fetch(data.scriptUrl);
            if (scriptResponse.ok) {
                const scriptContent = await scriptResponse.text();
                scriptText.textContent = scriptContent;
            } else {
                scriptText.textContent = 'Failed to load script content';
            }

            generationTimeP.textContent = `Podcast generated in ${generationTime.toFixed(2)} seconds`;

            // Hide loading indicator and show result with a smooth transition
            loadingDiv.style.opacity = '0';
            setTimeout(() => {
                loadingDiv.style.display = 'none';
                resultDiv.style.display = 'block';
                setTimeout(() => {
                    resultDiv.style.opacity = '1';
                }, 50);
            }, 300);

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while generating the podcast. Please try again.');
            // Hide loading indicator on error
            loadingDiv.style.display = 'none';
        }
    });

    // Add click event listeners to parameter items
    parameterItems.forEach(item => {
        item.addEventListener('click', function() {
            const select = this.querySelector('select');
            if (select) {
                select.focus();
            }
        });
    });

    // Recalculate PDF scale on window resize
    window.addEventListener('resize', () => {
        if (previewSection.style.display !== 'none') {
            const canvases = pdfViewer.querySelectorAll('canvas');
            canvases.forEach(canvas => {
                const scale = (pdfViewer.clientWidth - 20) / canvas.width;
                canvas.style.width = `${canvas.width * scale}px`;
                canvas.style.height = `${canvas.height * scale}px`;
            });
        }
    });
});
