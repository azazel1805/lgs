document.addEventListener('DOMContentLoaded', () => {
    const lessonSelect = document.getElementById('lessonSelect');
    const unitSelectGroup = document.getElementById('unitSelectGroup');
    const unitSelect = document.getElementById('unitSelect');
    const getTopicExplanationBtn = document.getElementById('getTopicExplanationBtn');
    const topicExplanationOutput = document.getElementById('topicExplanationOutput');
    const questionInput = document.getElementById('questionInput');
    const underlinedPhraseInput = document.getElementById('underlinedPhraseInput'); // YENİ: Altı çizili ifade input'u
    const askTextQuestionBtn = document.getElementById('askTextQuestionBtn');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const askImageQuestionBtn = document.getElementById('askImageQuestionBtn');
    const aiResponseOutput = document.getElementById('aiResponseOutput');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // LGS 8. Sınıf Dersleri ve Üniteleri
    const lgsCurriculum = {
        "Türkçe": [
            "Sözcükte Anlam", "Cümlede Anlam", "Parçada Anlam", "Metin Türleri",
            "Fiilimsiler", "Cümlenin Ögeleri", "Cümle Türleri", "Yazım Kuralları",
            "Noktalama İşaretleri", "Anlatım Bozuklukları", "Edebi Sanatlar"
        ],
        "Matematik": [
            "Çarpanlar ve Katlar", "Üslü İfadeler", "Kareköklü İfadeler", "Veri Analizi",
            "Basit Olayların Olma Olasılığı", "Cebirsel İfadeler ve Özdeşlikler",
            "Doğrusal Denklemler", "Eşitsizlikler", "Üçgenler", "Dönüşüm Geometrisi",
            "Geometrik Cisimler"
        ],
        "Fen Bilimleri": [
            "Mevsimler ve İklim", "DNA ve Genetik Kod", "Basınç", "Madde ve Endüstri",
            "Basit Makineler", "Enerji Dönüşümleri ve Çevre Bilimi",
            "Elektrik Yükleri ve Elektrik Enerjisi"
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

    // Yıl bilgisini footer'a ekle
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    // Ders seçimi dropdown'ını doldur
    for (const lesson in lgsCurriculum) {
        const option = document.createElement('option');
        option.value = lesson;
        option.textContent = lesson;
        lessonSelect.appendChild(option);
    }

    // Ders seçildiğinde ünitelere göre doldur
    lessonSelect.addEventListener('change', () => {
        const selectedLesson = lessonSelect.value;
        unitSelect.innerHTML = '<option value="">-- Konu Seçiniz --</option>'; // Önceki üniteleri temizle
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

    // Ünite seçildiğinde "Konu Anlatımını Getir" butonunu göster
    unitSelect.addEventListener('change', () => {
        if (unitSelect.value) {
            getTopicExplanationBtn.style.display = 'block';
        } else {
            getTopicExplanationBtn.style.display = 'none';
        }
    });

    // Konu anlatımını getir butonuna tıklama olayı
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

    // Metinle soru sor butonuna tıklama olayı
    askTextQuestionBtn.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        const underlinedPhrase = underlinedPhraseInput.value.trim(); // YENİ: Altı çizili ifadeyi al

        if (question) {
            let fullPrompt = question;
            if (underlinedPhrase) {
                // Altı çizili ifadeyi prompt'un başına ekliyoruz, böylece AI öncelik verir.
                fullPrompt = `[Kullanıcının belirttiği altı çizili ifade: "${underlinedPhrase}"]\n${question}`;
            }

            await getGeminiResponse({
                type: 'text',
                prompt: fullPrompt, // Oluşturulan prompt'u gönder
                lesson: lessonSelect.value || null,
                unit: unitSelect.value || null
            }, aiResponseOutput);
            questionInput.value = ''; // Input'u temizle
            underlinedPhraseInput.value = ''; // YENİ: Altı çizili ifade input'unu da temizle
        } else {
            alert('Lütfen bir soru yazınız.');
        }
    });

    // Resim yüklendiğinde önizleme yap ve yeniden boyutlandır/sıkıştır
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

    // Resimle soru sor butonuna tıklama olayı
    askImageQuestionBtn.addEventListener('click', async () => {
        console.log("DEBUG: Ask Image Question button clicked.");
        const resizedBase64 = imagePreview.dataset.resizedImage; 
        const question = questionInput.value.trim();
        const underlinedPhrase = underlinedPhraseInput.value.trim(); // YENİ: Altı çizili ifadeyi al
        console.log("DEBUG: Resized Base64 data present:", !!resizedBase64);
        console.log("DEBUG: Question input for image:", question);
        console.log("DEBUG: Underlined phrase for image:", underlinedPhrase); // DEBUG LOG


        if (resizedBase64) {
            let fullPrompt = question;
            if (underlinedPhrase) {
                // Altı çizili ifadeyi prompt'un başına ekliyoruz, böylece AI öncelik verir.
                fullPrompt = `[Kullanıcının belirttiği altı çizili ifade: "${underlinedPhrase}"]\n${question}`;
            } else if (!question) {
                // Sadece resim ve altı çizili ifade yoksa varsayılan bir prompt ver
                fullPrompt = "Bu resimdeki LGS sorusunu ve seçeneklerini dikkatlice incele. Eğer varsa, altı çizili ifadeyi tespit et ve o ifadenin mecazi, eylemsel anlamını ve metinle ilişkisini derinlemesine analiz et. Doğru seçeneği belirle ve bu seçeneğin neden doğru, diğerlerinin neden yanlış veya eksik olduğunu, özellikle pasif/aktif veya genel/spesifik anlam farklarını vurgulayarak metinle ilişkilendirerek adım adım açıkla. Cevabını yukarıdaki LGS yorumlama stratejisine uygun olarak yapılandır.";
            }

            console.log("DEBUG: Calling getGeminiResponse for image with fullPrompt:", fullPrompt);
            await getGeminiResponse({
                type: 'image',
                prompt: fullPrompt, // Oluşturulan prompt'u gönder
                image: resizedBase64,
                lesson: lessonSelect.value || null,
                unit: unitSelect.value || null
            }, aiResponseOutput);

            questionInput.value = ''; 
            underlinedPhraseInput.value = ''; // YENİ: Altı çizili ifade input'unu da temizle
            imageUpload.value = ''; 
            imagePreview.src = '';
            imagePreview.style.display = 'none';
            askImageQuestionBtn.style.display = 'none';
            delete imagePreview.dataset.resizedImage;
            console.log("DEBUG: Image question sent, form reset.");
        } else {
            alert('Lütfen önce bir resim yükleyiniz.');
            console.log("DEBUG: Alert: No resized image data found before sending.");
        }
    });

    // Gemini API'ye istek gönderme fonksiyonu
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
        questionInput.disabled = status;
        underlinedPhraseInput.disabled = status; // YENİ: Altı çizili ifade input'unu devre dışı bırak
        askTextQuestionBtn.disabled = status;
        imageUpload.disabled = status;
        askImageQuestionBtn.disabled = status;
    }
});
