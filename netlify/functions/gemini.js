const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
        };
    }

    let GEMINI_API_KEY;
    if (process.env.NETLIFY_DEV) {
        require('dotenv').config();
        GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    } else {
        GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    }

    if (!GEMINI_API_KEY) {
        console.error("Gemini API anahtarı bulunamadı.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Sunucu yapılandırma hatası: Gemini API anahtarı eksik." }),
        };
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const generationConfig = {
        temperature: 0.1, // ÇOK DÜŞÜK SICAKLIK! Modelin talimatlara mutlak sadakatle uyması ve minimum yaratıcılık sergilemesi için. (Önceki 0.2'den düşürüldü)
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096, // Detaylı açıklamalar için yeterli olmalı.
    };

    const safetySettings = [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
    ];

    try {
        const { type, prompt, image, lesson, unit } = JSON.parse(event.body);
        
        // *** SYSTEM INSTRUCTION, KULLANICI PROMPT'UNDAKİ İFADEYE ÖNCELİK VERMESİ İÇİN GÜNCELLENDİ ***
        let systemInstruction = `Sen bir LGS (8. sınıf) sınavına hazırlanan öğrencilere yardımcı olan, Türkiye Milli Eğitim Bakanlığı (MEB) müfredatına hakim, sabırlı, detaylı bilgi veren ve ÖZELLİKLE ANLATIŞ BİÇİMİ, METAFORİK İFADE YORUMLAMA, SEÇENEK ELEME VE MANTIKSAL ÇIKARIM GEREKTİREN TÜRKÇE, Sosyal Bilgiler vb. sorularında ÇOK ÇOK BAŞARILI OLAN bir yapay zeka asistanısın. Tüm cevaplarını Türkçe olarak ve 8. sınıf seviyesine uygun, anlaşılır bir dille vermelisin. Yanıtlarını verirken aşağıdaki kritik noktalara azami dikkat et:
        
        **ÖNEMLİ: EĞER KULLANICI PROMPT'UNDA (METİN KUTUSUNDA) BİR ALT-ÇİZİLİ İFADE VEYA ANAHTAR KAVRAM BELİRTMİŞSE, GÖRSELDEKİ POTANSİYEL VURGULARDAN BAĞIMSIZ OLARAK KESİNLİKLE O METİNSEL İFADEYİ DİKKATE AL. GÖRSEL ALGILAMASINDAKİ OLASI HATALARINI ENGELLEMEK İÇİN KULLANICININ VERDİĞİ METİNSEL TALİMAT ESAS ALINMALIDIR.**

        **LGS Yorumlama ve Seçenek Eleme Stratejisi:**
        1.  **Soruyu Anlama ve Odağı Belirleme:** Sorunun tam olarak ne istediğini belirle. Özellikle altı çizili ifade, deyim veya cümlenin **mecazi, yan ve derin anlamlarına** odaklan. Yazarın bu ifadeyi neden kullandığını, ne amaçladığını metnin genel bağlamında analiz et. Sadece genel temaları değil, ifadenin **özgül, aktif ve eylemsel** anlamını bulmaya çalış.
        2.  **Seçenekleri Titizlikle Değerlendirme:**
            *   **Her seçeneği ayrı ayrı ele al.** Metindeki ifadeyle doğrudan ve en güçlü bağlantıyı kuranı bulmaya çalış.
            *   **Hatalı veya Eksik Seçenekleri Eleme:** Diğer seçeneklerin **neden doğru olmadığını veya neden sorulan ifadeyi tam olarak karşılamadığını** net bir şekilde açıkla. Bazı seçenekler genel olarak doğru gibi görünse de, altı çizili ifadenin özgül anlamını tam olarak yansıtmayabilir; bu farkı vurgula. Özellikle yanlış seçeneklerin, doğru seçeneğin vurguladığı spesifik eylemselliği veya mecazi anlamı barındırmadığını açıkça belirt.
        3.  **Gerekçeli ve Adım Adım Açıklama:** Seçtiğin doğru cevabı ve elediğin yanlış cevapları metindeki somut kanıtlarla, ipuçlarıyla ve mantıksal çıkarımlarla adım adım, açık ve anlaşılır bir şekilde gerekçelendir.
        4.  **Öğretici ve LGS Uyumlu Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme, öğrencinin konuyu ve yorumlama mantığını kavramasını sağla. Yanıtın LGS soru çözüm stratejilerini yansıttığından emin ol.
        5.  **Yapılandırılmış Yanıt:** Cevabını belirgin başlıklar (örn. "1. Sorunun ve İfadenin Analizi", "2. Seçeneklerin Titizlikle Değerlendirilmesi", "3. Doğru Cevap ve Kapsamlı Gerekçesi") ve madde işaretleri kullanarak yapılandır.`;

        if (lesson && unit) {
            systemInstruction += ` Şu anda öğrenci "${lesson}" dersinin "${unit}" ünitesi hakkında bilgi alıyor veya soru soruyor. Bu konuya odaklanarak ve LGS bağlamında yanıtlar ver.`;
        } else if (lesson) {
             systemInstruction += ` Şu anda öğrenci "${lesson}" dersi hakkında bilgi alıyor veya soru soruyor. Bu derse uygun yanıtlar ver.`;
        }
        
        const requestParts = [];

        if (type === 'topic_explanation') {
            const explanationPrompt = `LGS 8. sınıf müfredatına göre "${lesson}" dersinin "${unit}" ünitesini detaylıca, maddeler halinde ve örneklerle açıklar mısın? Öğrencinin konuyu eksiksiz kavramasını sağlayacak şekilde kapsamlı bir anlatım yap.`;
            requestParts.push({ text: explanationPrompt });
        } else if (type === 'text') {
            requestParts.push({ text: prompt });
        } else if (type === 'image') {
            if (image) {
                requestParts.push({
                    inlineData: {
                        mimeType: "image/jpeg", 
                        data: image,
                    },
                });
            }
            if (prompt) { // Kullanıcı resimle birlikte metin de sağladıysa, metni direk kullan
                requestParts.push({ text: prompt });
            } else { // Kullanıcı sadece resim sağladıysa, modelden altı çizili ifadeyi tespit etmesini ve yorumlamasını iste
                requestParts.push({ text: "Bu resimdeki LGS sorusunu ve seçeneklerini dikkatlice incele. Eğer varsa, altı çizili ifadeyi tespit et ve onun mecazi anlamını ve metinle ilişkisini detaylıca açıkla. Doğru seçeneği belirle ve bu seçeneğin neden doğru, diğerlerinin neden yanlış veya eksik olduğunu metinle ilişkilendirerek adım adım açıkla. Cevabını yukarıdaki LGS yorumlama stratejisine uygun olarak yapılandır." });
            }
        }

        if (requestParts.length === 0) {
            return {
                statusCode: 400,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ error: "Geçersiz istek: Boş içerik gönderildi. Lütfen metin veya resim sağlayın." }),
            };
        }

        const result = await model.generateContent({
            contents: [{
                role: "user",
                parts: requestParts
            }],
            generationConfig,
            safetySettings,
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            }
        });

        const responseContent = result.response.text();

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ response: responseContent }),
        };

    } catch (error) {
        console.error('Netlify Fonksiyonu veya Gemini API Hatası:', error);
        const errorMessage = `AI yanıtı alınırken bir sorun oluştu: ${error.message}`;
        const errorDetails = process.env.NODE_ENV !== 'production' ? error.stack : undefined;

        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
                error: errorMessage,
                details: errorDetails
            }),
        };
    }
};
