document.addEventListener('DOMContentLoaded', () => {
    const lessonSelect = document.getElementById('lessonSelect');
    const unitSelectGroup = document.getElementById('unitSelectGroup');
    const unitSelect = document.getElementById('unitSelect');
    const getTopicExplanationBtn = document.getElementById('getTopicExplanationBtn');
    const topicExplanationOutput = document.getElementById('topicExplanationOutput');
    const questionTypeSelect = document.getElementById('questionTypeSelect');
    const questionInput = document.getElementById('questionInput');
    const underlinedPhraseInput = document.getElementById('underlinedPhraseInput');
    const askTextQuestionBtn = document.getElementById('askTextQuestionBtn');
    const aiResponseOutput = document.getElementById('aiResponseOutput');
    const loadingIndicator = document.getElementById('loadingIndicator');

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

    function createPrompt(questionText, detailsText) {
        let fullPrompt = questionText;
        if (detailsText) {
            fullPrompt = `[Kullanıcının belirttiği detaylar: "${detailsText}"]\n${questionText}`;
        }
        return fullPrompt;
    }

    askTextQuestionBtn.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        const details = underlinedPhraseInput.value.trim();
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

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    const rawErrorText = await response.text();
                    throw new Error(`Sunucudan hatalı yanıt alındı (Durum: ${response.status}). Yanıt JSON değil veya bozuk: ${rawErrorText.substring(0, 200)}...`);
                }
                throw new Error(errorData.error || `HTTP error! Status: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            if (data.error) {
                outputElement.innerHTML = `<div class="error-message">${data.error}</div>`;
            } else {
                // YANITI MARKDOWN'DAN HTML'E ÇEVİRİYORUZ
                outputElement.innerHTML = marked.parse(data.response);
            }
        } catch (error) {
            console.error('API isteği başarısız oldu:', error);
            outputElement.innerHTML = `<div class="error-message">Bir hata oluştu: ${error.message}. Lütfen tekrar deneyin.</div>`;
        } finally {
            loadingIndicator.style.display = 'none';
            disableControls(false);
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
    }
});
