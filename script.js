document.addEventListener('DOMContentLoaded', () => {
    const lessonSelect = document.getElementById('lessonSelect');
    const unitSelectGroup = document.getElementById('unitSelectGroup');
    const unitSelect = document.getElementById('unitSelect');
    const getTopicExplanationBtn = document.getElementById('getTopicExplanationBtn');
    const topicExplanationOutput = document.getElementById('topicExplanationOutput');
    const questionTypeSelect = document.getElementById('questionTypeSelect');
    const questionInput = document.getElementById('questionInput');
    const underlinedPhraseInput = document.getElementById('underlinedPhraseInput'); // Artık "detay" alanı
    const askTextQuestionBtn = document.getElementById('askTextQuestionBtn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const askImageQuestionBtn = document.getElementById('askImageQuestionBtn');
    const aiResponseOutput = document.getElementById('aiResponseOutput');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // LGS 8. Sınıf Dersleri ve Üniteleri - SADECE İSTENEN DERSLER DAHİL EDİLDİ
    const lgsCurriculum = {
        "Türkçe": [
            "Sözcükte Anlam", "Cümlede Anlam", "Parçada Anlam", "Metin Türleri",
            "Fiilimsiler", "Cümlenin Ögeleri", "Cümle Türleri", "Yazım Kuralları",
            "Noktalama İşaretleri", "Anlatım Bozuklukları", "Edebi Sanatlar"
        ],
        "T.C. İnkılap Tarihi ve Atatürkçülük": [
            "Bir Kahraman Doğuyor", "Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar",
            "Millî Bir Destan: Ya İstiklal Ya Ölüm!", "Çağdaş Türkiye Yolunda Adımlar",
            "Atatürkçülük ve Çağdaşlaşan Türkiye", "Atatürk Dönemi Türk Dış Politikası",
            "Atatürk'ün Ölümü ve Sonrası"
        ],
        "Yabancı Dil (İngilizce)": [
            "Friendship", "Teen Life", "In the Kitchen", "On the Phone", "The Internet",
            "Adventures", "Tourism", "Home Chores", "Science", "Natural Forces"
        ],
        "Din Kültürü ve Ahlâk Bilgisi": [
            "Kader İnancı", "Zekât ve Sadaka", "Din ve Hayat", "Hz. Muhammed'in Örnekliği",
            "Kur'an-ı Kerim ve Özellikleri"
        ]
    };

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    for (const lesson in lgsCurriculum) {
        const option = document.createElement('option');
        option.value = lesson;
        option.textContent = lesson;
        lessonSelect.appendChild(option);
    }

    lessonSelect.addEventListener('change', () => {
        const selectedLesson = lessonSelect.value;
        unitSelect.innerHTML = '<option value="">-- Konu Seçiniz --</option>';
        topicExplanationOutput.innerHTML = '<p class="placeholder">Yukarıdan bir ders ve konu seçerek detaylı anlatımını alabilirsiniz.</p>';
        getTopicExplanationBtn.style.display = 'none';

        if (selectedLesson) {
            unitSelectGroup.style.display = 'block';
            lgsCurriculum[selectedLesson].forEach(unit => {
                const option = document.createElement('option');
                option.value = unit;
                option.textContent = unit;
                unitSelect.appendChild(option);
            });
        } else {
            unitSelectGroup.style.display = 'none';
        }
    });

    unitSelect.addEventListener('change', () => {
        if (unitSelect.value) {
            getTopicExplanationBtn.style.display = 'block';
        } else {
            getTopicExplanationBtn.style.display = 'none';
        }
    });

    getTopicExplanationBtn.addEventListener('click', async () => {
        const selectedLesson = lessonSelect.value;
        const selectedUnit = unitSelect.value;

        if (selectedLesson && selectedUnit) {
            await getGeminiResponse({
                type: 'topic_explanation',
                lesson: selectedLesson,
                unit: selectedUnit
            }, topicExplanationOutput);
        } else {
            alert('Lütfen bir ders ve konu seçiniz.');
        }
    });

    // Prompt oluşturma yardımcı fonksiyonu
    function createPrompt(questionText, detailsText) { // underlinedPhraseText yerine detailsText
        let fullPrompt = questionText;
        if (detailsText) {
            fullPrompt = `[Kullanıcının belirttiği detaylar: "${detailsText}"]\n${questionText}`;
        }
        return fullPrompt;
    }

    askTextQuestionBtn.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        const details = underlinedPhraseInput.value.trim(); // "detay" alanını al
        const questionType = questionTypeSelect.value;

        if (!questionType) {
            alert('Lütfen bir soru türü seçiniz.');
            return;
        }
        if (!question) {
            alert('Lütfen bir soru metni ve seçenekleri giriniz.');
            return;
        }

        const fullPrompt = createPrompt(question, details);

        await getGeminiResponse({
            type: 'text',
            prompt: fullPrompt,
            questionType: questionType,
            lesson: lessonSelect.value || null,
            unit: unitSelect.value || null
        }, aiResponseOutput);
        questionInput.value = '';
        underlinedPhraseInput.value = '';
        questionTypeSelect.value = '';
    });

    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        console.log("DEBUG: Image upload change event triggered. File:", file ? file.name : "No file");
        
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        askImageQuestionBtn.style.display = 'none'; 
        delete imagePreview.dataset.resizedImage;

        if (file) {
            aiResponseOutput.innerHTML = '<p class="placeholder">AI yanıtları burada belirecektir.</p>';
            
            const MAX_SIZE = 1024;
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                console.log("DEBUG: Image reader loaded. Image src set.");

                img.onload = () => {
                    console.log("DEBUG: Image object loaded. Starting canvas resize.");
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_SIZE) {
                            height *= MAX_SIZE / width;
                            width = MAX_SIZE;
                        }
                    } else {
                        if (height > MAX_SIZE) {
                            width *= MAX_SIZE / height;
                            height = MAX_SIZE;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                    
                    if (resizedBase64) {
                        imagePreview.src = resizedBase64;
                        imagePreview.style.display = 'block';
                        askImageQuestionBtn.style.display = 'inline-block'; 
                        console.log("DEBUG: askImageQuestionBtn style after success:", askImageQuestionBtn.style.display);

                        imagePreview.dataset.resizedImage = resizedBase64.split(',')[1];
                        console.log("DEBUG: Resized image data set.");
                    } else {
                        console.error("DEBUG: toDataURL returned empty or invalid data.");
                        alert("Resim işlenirken bir hata oluştu. Lütfen farklı bir resim deneyin.");
                        imageUpload.value = '';
                        imagePreview.src = '';
                        imagePreview.style.display = 'none';
                        askImageQuestionBtn.style.display = 'none'; 
                        delete imagePreview.dataset.resizedImage;
                    }
                };
                img.onerror = () => {
                    console.error("DEBUG: Resim yüklenemedi veya bozuk.");
                    alert("Yüklenen resim geçersiz veya bozuk. Lütfen başka bir resim deneyin.");
                    imageUpload.value = '';
                    imagePreview.src = '';
                    imagePreview.style.display = 'none';
                    askImageQuestionBtn.style.display = 'none'; 
                    delete imagePreview.dataset.resizedImage;
                };
            };
            reader.readAsDataURL(file);
        } else {
            console.log("DEBUG: No file selected or selection cancelled. All elements hidden.");
        }
    });

    askImageQuestionBtn.addEventListener('click', async () => {
        console.log("DEBUG: Ask Image Question button clicked.");
        const resizedBase64 = imagePreview.dataset.resizedImage; 
        const question = questionInput.value.trim();
        const details = underlinedPhraseInput.value.trim(); // "detay" alanını al
        const questionType = questionTypeSelect.value;

        if (!questionType) {
            alert('Lütfen bir soru türü seçiniz.');
            return;
        }
        // Görsel varsa, metin kutularının da dolu olmasını zorunlu kıl
        if (resizedBase64 && !question) {
             alert('Resimle birlikte soru metnini ve seçeneklerini de (üstteki kutuya) girmeniz gerekmektedir.');
             return;
        }
        // Hem metin hem resim yoksa uyarı ver
        if (!question && !resizedBase64) {
            alert('Lütfen bir soru metni ve seçenekleri giriniz veya bir resim yükleyiniz (resim yüklüyorsanız metni de girin).');
            return;
        }

        const fullPrompt = createPrompt(question, details); // Yardımcı fonksiyonu kullan

        console.log("DEBUG: Calling getGeminiResponse for image with fullPrompt:", fullPrompt);
        await getGeminiResponse({
            type: 'image', // type hala 'image'
            prompt: fullPrompt,
            questionType: questionType,
            image: resizedBase64,
            lesson: lessonSelect.value || null,
            unit: unitSelect.value || null
        }, aiResponseOutput);

        questionInput.value = ''; 
        underlinedPhraseInput.value = '';
        questionTypeSelect.value = '';
        imageUpload.value = ''; 
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        askImageQuestionBtn.style.display = 'none';
        delete imagePreview.dataset.resizedImage;
        console.log("DEBUG: Image question sent, form reset.");
    });

    async function getGeminiResponse(payload, outputElement) {
        outputElement.innerHTML = '';
        loadingIndicator.style.display = 'flex';
        disableControls(true);
        console.log("DEBUG: Sending request to Netlify Function with payload:", payload);

        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            console.log("DEBUG: Response received from Netlify Function. Status:", response.status);

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                    console.log("DEBUG: Error response data (JSON):", errorData);
                } catch (e) {
                    const rawErrorText = await response.text();
                    console.error("DEBUG: Failed to parse error response as JSON. Raw text:", rawErrorText.substring(0, 200) + "...");
                    throw new Error(`Sunucudan hatalı yanıt alındı (Durum: ${response.status}). Yanıt JSON değil veya bozuk: ${rawErrorText.substring(0, 200)}...`);
                }
                throw new Error(errorData.error || `HTTP error! Status: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            console.log("DEBUG: Successful response data:", data);
            if (data.error) {
                outputElement.innerHTML = `<p class="error-message">Hata: ${data.error}</p>`;
            } else {
                outputElement.innerHTML = `<p>${data.response}</p>`;
            }
        } catch (error) {
            console.error('DEBUG: API isteği başarısız oldu:', error);
            outputElement.innerHTML = `<p class="error-message">Bir hata oluştu: ${error.message}. Lütfen tekrar deneyin.</p>`;
        } finally {
            loadingIndicator.style.display = 'none';
            disableControls(false);
            console.log("DEBUG: Request finished. Controls enabled.");
        }
    }

    function disableControls(status) {
        lessonSelect.disabled = status;
        unitSelect.disabled = status;
        getTopicExplanationBtn.disabled = status;
        questionTypeSelect.disabled = status;
        questionInput.disabled = status;
        underlinedPhraseInput.disabled = status;
        askTextQuestionBtn.disabled = status;
        imageUpload.disabled = status;
        askImageQuestionBtn.disabled = status;
    }
});
