document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elementleri ---
    const lessonSelect = document.getElementById('lessonSelect');
    const unitSelectGroup = document.getElementById('unitSelectGroup');
    const unitSelect = document.getElementById('unitSelect');
    const getTopicExplanationBtn = document.getElementById('getTopicExplanationBtn');
    const getTopicSummaryBtn = document.getElementById('getTopicSummaryBtn');
    const topicExplanationOutput = document.getElementById('topicExplanationOutput');
    const questionInput = document.getElementById('questionInput');
    const detailsInput = document.getElementById('detailsInput');
    const askTextQuestionBtn = document.getElementById('askTextQuestionBtn');
    const aiResponseOutput = document.getElementById('aiResponseOutput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const historyBtn = document.getElementById('historyBtn');
    const historyModal = document.getElementById('historyModal');
    const closeHistoryModal = document.getElementById('closeHistoryModal');
    const historyContainer = document.getElementById('historyContainer');
    const historyTabs = document.querySelector('.history-tabs');

    // --- Veri ---
    const lgsCurriculum = {
        "Türkçe": ["Sözcükte Anlam", "Cümlede Anlam", "Parçada Anlam", "Metin Türleri", "Fiilimsiler", "Cümlenin Ögeleri", "Cümle Türleri", "Yazım Kuralları", "Noktalama İşaretleri", "Anlatım Bozuklukları", "Edebi Sanatlar"],
        "T.C. İnkılap Tarihi ve Atatürkçülük": ["Bir Kahraman Doğuyor", "Millî Uyanış: Bağımsızlık Yolunda Atılan Adımlar", "Millî Bir Destan: Ya İstiklal Ya Ölüm!", "Çağdaş Türkiye Yolunda Adımlar", "Atatürkçülük ve Çağdaşlaşan Türkiye", "Atatürk Dönemi Türk Dış Politikası", "Atatürk'ün Ölümü ve Sonrası"],
        "Yabancı Dil (İngilizce)": ["Friendship", "Teen Life", "In the Kitchen", "On the Phone", "The Internet", "Adventures", "Tourism", "Home Chores", "Science", "Natural Forces"],
        "Din Kültürü ve Ahlâk Bilgisi": ["Kader İnancı", "Zekât ve Sadaka", "Din ve Hayat", "Hz. Muhammed'in Örnekliği", "Kur'an-ı Kerim ve Özellikleri"]
    };

    let fullHistory = JSON.parse(localStorage.getItem('lgsAiHistory')) || [];
    let reviewList = JSON.parse(localStorage.getItem('lgsAiReviewList')) || [];

    // --- Başlangıç Ayarları ---
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    for (const lesson in lgsCurriculum) {
        const option = document.createElement('option');
        option.value = lesson;
        option.textContent = lesson;
        lessonSelect.appendChild(option);
    }

    // --- localStorage Fonksiyonları ---
    const saveHistory = () => localStorage.setItem('lgsAiHistory', JSON.stringify(fullHistory));
    const saveReviewList = () => localStorage.setItem('lgsAiReviewList', JSON.stringify(reviewList));

    // --- Render Fonksiyonları ---
    function renderHistory(tab = 'all') {
        historyContainer.innerHTML = '';
        const listToRender = tab === 'review' ? reviewList : fullHistory;
        
        if (listToRender.length === 0) {
            historyContainer.innerHTML = `<p class="placeholder">${tab === 'review' ? 'Tekrar edilecek soru bulunmuyor.' : 'Henüz çözülmüş soru bulunmuyor.'}</p>`;
            return;
        }

        listToRender.slice().reverse().forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'history-item';
            itemEl.innerHTML = `
                <h4>${item.lesson || 'Genel Soru'}</h4>
                <div class="question-text">${item.question}</div>
                <div class="answer-text">${item.answer}</div>
                <div class="item-footer">${new Date(item.timestamp).toLocaleString('tr-TR')}</div>
            `;
            historyContainer.appendChild(itemEl);
        });
    }

    // --- Olay Dinleyicileri (Event Listeners) ---
    lessonSelect.addEventListener('change', () => {
        const selectedLesson = lessonSelect.value;
        unitSelect.innerHTML = '<option value="">-- Konu Seçiniz --</option>';
        topicExplanationOutput.innerHTML = '<p class="placeholder">Yukarıdan bir ders ve konu seçerek detaylı anlatımını alabilirsiniz.</p>';
        const showButtons = selectedLesson !== '';
        unitSelectGroup.style.display = showButtons ? 'block' : 'none';
        
        if (showButtons) {
            lgsCurriculum[selectedLesson].forEach(unit => {
                const option = document.createElement('option');
                option.value = unit;
                option.textContent = unit;
                unitSelect.appendChild(option);
            });
        }
    });

    unitSelect.addEventListener('change', () => {
        const showButtons = unitSelect.value !== '';
        getTopicExplanationBtn.style.display = showButtons ? 'block' : 'none';
        getTopicSummaryBtn.style.display = showButtons ? 'block' : 'none';
    });

    getTopicExplanationBtn.addEventListener('click', () => handleTopicRequest('topic_explanation'));
    getTopicSummaryBtn.addEventListener('click', () => handleTopicRequest('topic_summary'));

    async function handleTopicRequest(type) {
        const selectedLesson = lessonSelect.value;
        const selectedUnit = unitSelect.value;
        if (selectedLesson && selectedUnit) {
            await getGeminiResponse({ type, lesson: selectedLesson, unit: selectedUnit }, topicExplanationOutput);
        } else {
            alert('Lütfen bir ders ve konu seçiniz.');
        }
    }

    function createPrompt(questionText, detailsText) {
        let fullPrompt = questionText;
        if (detailsText) {
            fullPrompt = `[Kullanıcının belirttiği ek detaylar/odak noktası: "${detailsText}"]\n${questionText}`;
        }
        return fullPrompt;
    }

    askTextQuestionBtn.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        const details = detailsInput.value.trim();
        const selectedLessonForQuestion = lessonSelect.value;
        
        if (!selectedLessonForQuestion) {
            alert('Lütfen sorunun hangi derse ait olduğunu sol taraftan seçiniz.');
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
            lesson: selectedLessonForQuestion,
            unit: unitSelect.value || null
        }, aiResponseOutput);
        questionInput.value = '';
        detailsInput.value = '';
    });

    historyBtn.addEventListener('click', () => {
        historyModal.style.display = 'flex';
        renderHistory();
    });

    closeHistoryModal.addEventListener('click', () => {
        historyModal.style.display = 'none';
    });
    
    historyTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            document.querySelector('.tab-btn.active').classList.remove('active');
            e.target.classList.add('active');
            renderHistory(e.target.dataset.tab);
        }
    });

    // Eylem butonları için olay delegasyonu
    document.body.addEventListener('click', async (e) => {
        if (e.target.classList.contains('action-btn')) {
            const action = e.target.dataset.action;
            const outputArea = e.target.closest('.output-area');
            const originalQuestion = outputArea.dataset.originalQuestion;
            const originalLesson = outputArea.dataset.originalLesson;

            if (action === 'review') {
                const lastQuestion = fullHistory[fullHistory.length - 1];
                if (lastQuestion && !reviewList.find(item => item.timestamp === lastQuestion.timestamp)) {
                    reviewList.push(lastQuestion);
                    saveReviewList();
                    e.target.textContent = 'Tekrar Listesine Eklendi!';
                    e.target.classList.add('added');
                    e.target.disabled = true;
                }
            } else if (action === 'deepen') {
                await getGeminiResponse({
                    type: 'deepen_concept',
                    prompt: originalQuestion,
                    lesson: originalLesson
                }, outputArea);
            } else if (action === 'similar') {
                await getGeminiResponse({
                    type: 'generate_similar',
                    prompt: originalQuestion,
                    lesson: originalLesson
                }, outputArea);
            }
        }
    });


    async function getGeminiResponse(payload, outputElement) {
        outputElement.innerHTML = '';
        loadingIndicator.style.display = 'flex';
        disableControls(true);

        try {
            const response = await fetch('/.netlify/functions/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Sunucudan geçersiz yanıt alındı.' }));
                throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) {
                outputElement.innerHTML = `<div class="error-message">${data.error}</div>`;
            } else {
                const formattedHtml = marked.parse(data.response);
                outputElement.innerHTML = formattedHtml;

                if (payload.type === 'text') {
                    const timestamp = Date.now();
                    outputElement.dataset.timestamp = timestamp;
                    outputElement.dataset.originalQuestion = payload.prompt;
                    outputElement.dataset.originalLesson = payload.lesson;
                    
                    fullHistory.push({
                        question: payload.prompt,
                        lesson: payload.lesson,
                        answer: formattedHtml,
                        timestamp: timestamp
                    });
                    saveHistory();
                    
                    const template = document.getElementById('actionButtonsTemplate').innerHTML;
                    outputElement.insertAdjacentHTML('beforeend', template);
                }
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
        getTopicSummaryBtn.disabled = status;
        questionInput.disabled = status;
        detailsInput.disabled = status;
        askTextQuestionBtn.disabled = status;
    }
});
