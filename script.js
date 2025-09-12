document.addEventListener('DOMContentLoaded', () => {
    const lessonSelect = document.getElementById('lessonSelect');
    const unitSelectGroup = document.getElementById('unitSelectGroup');
    const unitSelect = document.getElementById('unitSelect');
    const getTopicExplanationBtn = document.getElementById('getTopicExplanationBtn');
    const topicExplanationOutput = document.getElementById('topicExplanationOutput');
    const questionInput = document.getElementById('questionInput');
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
        if (question) {
            await getGeminiResponse({
                type: 'text',
                prompt: question,
                lesson: lessonSelect.value || null, // Bağlam için seçili dersi gönder
                unit: unitSelect.value || null     // Bağlam için seçili üniteyi gönder
            }, aiResponseOutput);
            questionInput.value = ''; // Input'u temizle
        } else {
            alert('Lütfen bir soru yazınız.');
        }
    });

    // Resim yüklendiğinde önizleme yap ve yeniden boyutlandır/sıkıştır
    imageUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const MAX_SIZE = 1024; // Maksimum genişlik veya yükseklik (piksel)
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;

                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Resmi yeniden boyutlandırma
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

                    // Yeniden boyutlandırılmış resmi JPEG olarak dışa aktar ve kaliteyi düşür
                    canvas.toDataURL('image/jpeg', 0.7) // 0.7 kalite (0.0 - 1.0 arası)
                        .then(resizedBase64 => {
                            imagePreview.src = resizedBase64;
                            imagePreview.style.display = 'block';
                            // RESİM İŞLEME BAŞARILIYSA BUTONU GÖSTER
                            askImageQuestionBtn.style.display = 'inline-block'; 

                            // Yeniden boyutlandırılmış ve sıkıştırılmış resmi bir data attribute olarak sakla
                            imagePreview.dataset.resizedImage = resizedBase64.split(',')[1]; // Base64 kısmını al
                        })
                        .catch(error => {
                            console.error("Resim yeniden boyutlandırma/sıkıştırma hatası:", error);
                            alert("Resim işlenirken bir hata oluştu. Lütfen farklı bir resim deneyin.");
                            // Hata durumunda formu ve butonu sıfırla
                            imageUpload.value = '';
                            imagePreview.src = '';
                            imagePreview.style.display = 'none';
                            askImageQuestionBtn.style.display = 'none'; 
                            delete imagePreview.dataset.resizedImage;
                        });
                };
                img.onerror = () => {
                    console.error("Resim yüklenemedi veya bozuk.");
                    alert("Yüklenen resim geçersiz veya bozuk. Lütfen başka bir resim deneyin.");
                    // Hata durumunda formu ve butonu sıfırla
                    imageUpload.value = '';
                    imagePreview.src = '';
                    imagePreview.style.display = 'none';
                    askImageQuestionBtn.style.display = 'none'; 
                    delete imagePreview.dataset.resizedImage;
                };
            };
            reader.readAsDataURL(file);
        } else {
            // Dosya seçimi iptal edildiğinde veya dosya yoksa her şeyi sıfırla
            imagePreview.src = '';
            imagePreview.style.display = 'none';
            askImageQuestionBtn.style.display = 'none'; 
            delete imagePreview.dataset.resizedImage; // Saklanan resmi temizle
        }
    });

    // Resimle soru sor butonuna tıklama olayı
    askImageQuestionBtn.addEventListener('click', async () => {
        // Önizleme elementinde sakladığımız yeniden boyutlandırılmış Base64 string'ini alıyoruz
        const resizedBase64 = imagePreview.dataset.resizedImage; 
        const question = questionInput.value.trim(); 

        if (resizedBase64) {
            await getGeminiResponse({
                type: 'image',
                prompt: question,
                image: resizedBase64, // Yeniden boyutlandırılmış ve sıkıştırılmış resmi gönder
                lesson: lessonSelect.value || null,
                unit: unitSelect.value || null
            }, aiResponseOutput);

            // Başarılı gönderimden sonra formu temizle
            questionInput.value = ''; 
            imageUpload.value = ''; 
            imagePreview.src = '';
            imagePreview.style.display = 'none';
            askImageQuestionBtn.style.display = 'none';
            delete imagePreview.dataset.resizedImage; // Saklanan resmi temizle
        } else {
            alert('Lütfen önce bir resim yükleyiniz.');
        }
    });

    // Gemini API'ye istek gönderme fonksiyonu
    async function getGeminiResponse(payload, outputElement) {
        outputElement.innerHTML = '';
        loadingIndicator.style.display = 'flex';
        disableControls(true);

        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            // Hata yanıtının JSON olup olmadığını kontrol et
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json(); // JSON yanıtı almaya çalış
                } catch (e) {
                    // JSON değilse veya bozuksa, ham metni al
                    const rawErrorText = await response.text();
                    throw new Error(`Sunucudan hatalı yanıt alındı (Durum: ${response.status}). Yanıt JSON değil veya bozuk: ${rawErrorText.substring(0, 200)}...`);
                }
                // Hata verisi içinde 'error' alanı yoksa genel bir mesaj kullan
                throw new Error(errorData.error || `HTTP error! Status: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                outputElement.innerHTML = `<p class="error-message">Hata: ${data.error}</p>`;
            } else {
                // Yanıtı Markdown olarak işleyebiliriz, ancak basit p etiketi yeterli olabilir
                // Eğer Markdown desteği eklemek isterseniz burada bir kütüphane kullanmalısınız.
                outputElement.innerHTML = `<p>${data.response}</p>`;
            }
        } catch (error) {
            console.error('API isteği başarısız oldu:', error);
            outputElement.innerHTML = `<p class="error-message">Bir hata oluştu: ${error.message}. Lütfen tekrar deneyin.</p>`;
        } finally {
            loadingIndicator.style.display = 'none';
            disableControls(false);
        }
    }

    function disableControls(status) {
        lessonSelect.disabled = status;
        unitSelect.disabled = status;
        getTopicExplanationBtn.disabled = status;
        questionInput.disabled = status;
        askTextQuestionBtn.disabled = status;
        imageUpload.disabled = status;
        askImageQuestionBtn.disabled = status;
    }
});
