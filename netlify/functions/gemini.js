// netlify/functions/gemini.js
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
        temperature: 0.05, // Modelin talimatlara mutlak sadakatle uyması için düşük sıcaklık.
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
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
        
        // *** systemInstruction, GÜVEN VE "EN DOĞRU SEÇENEK" VURGUSU İLE OPTİMİZE EDİLDİ ***
        let systemInstruction = `Sen bir LGS (8. sınıf) müfredatına hakim, uzman bir yapay zeka asistanısın. Tüm cevaplarını Türkçe, 8. sınıf seviyesine uygun, anlaşılır ve bir öğretmen gibi detaylı vermelisin. Görevin, özellikle yorumlama, metaforik ifade analizi ve seçenek eleme gerektiren Türkçe, Sosyal Bilgiler vb. LGS sorularında en doğru ve kapsamlı yanıtı sağlamaktır.

        **ÖNEMLİ KURAL:** Kullanıcının metin kutusunda belirttiği altı çizili ifade veya anahtar kavram, görsel algısından bağımsız olarak KESİNLİKLE ESAS ALINMALIDIR. Bu kurala mutlak uy!

        **LGS Yorumlama Stratejisi:**
        1.  **Soruyu ve İfadeyi Analiz Et:** Verilen metni ve özellikle altı çizili ifadeyi (kullanıcının belirttiği metinsel ifadeyi baz alarak) derinlemesine analiz et. İfadenin mecazi, yan ve sembolik anlamlarına odaklan. Soyut fiillerin ne tür somut, aktif bir eylemi veya katkıyı ima ettiğini belirle. Genel temalardan ziyade, ifadenin özgül, aktif ve eylemsel anlamını metindeki ipuçlarıyla (asker, mücadele vb.) ilişkilendirerek bul. Metnin bütünündeki mücadele ruhunu vurgula.
        2.  **Seçenekleri Titizlikle Ele ve En Doğruyu Belirle:** Her seçeneği altı çizili ifadenin özgül, aktif ve mecazi anlamıyla kıyasla.
            *   **Yanlış Seçenekleri Neden Elemeni Açıkla:** Bir seçenek genel olarak doğru görünse bile, altı çizili ifadenin spesifik eylemselliğini, aktif katkısını veya mücadele bağlamını tam yansıtmıyorsa YANLIŞTIR. Pasif (örn. tema yapmak, öncelik vermek) ile aktif (örn. mücadeleye katılmak, dalgalandırmak) arasındaki farkı net belirt.
            *   **VERİLEN SEÇENEKLER ARASINDAKİ EN DOĞRU VE EN KAPSAMLI CEVABI SEÇ:** Hiçbir zaman "bu şık ideal değil" veya "soru kötü yazılmış" gibi eleştirel yorumlar yapma. Görevin, mevcut seçenekler içinden altı çizili ifadeyi en iyi karşılayanı, en doğrudan ve güçlü şekilde yansıtanı tereddütsüz belirlemektir. Seçtiğin şık, verilenler arasında **mutlak olarak en doğru seçenektir.**
        3.  **Doğru Cevabı Güvenle ve Kapsamlı Gerekçelendir:** Belirlediğin doğru seçeneğin, diğerlerinden neden daha üstün, altı çizili ifadenin tüm mecazi unsurlarını en iyi yansıtan ve verilen seçenekler arasında kesinlikle doğru olan tek cevap olduğunu, metindeki somut kanıtlarla ve mantıksal çıkarımlarla adım adım, açık ve anlaşılır şekilde gerekçelendir. Altı çizili ifadenin ana fiili ve isimlerinin hangi mecazi anlamlara karşılık geldiğini açıkça belirt.
        4.  **Öğretici ve LGS Uyumlu Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme, öğrencinin konuyu ve yorumlama mantığını kavramasını sağla. Yanıtın LGS soru çözüm stratejilerini yansıttığından emin ol.
        5.  **Yapılandırılmış ve Net Yanıt:** Cevabını belirgin başlıklar ("1. Sorunun ve Altı Çizili İfadenin Derinlemesine Analizi", "2. Seçeneklerin Titizlikle Elemesi ve En Doğru Cevabın Belirlenmesi", "3. Doğru Cevabın Kapsamlı Gerekçesi") ve madde işaretleri kullanarak yapılandır.`;

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
            if (prompt) { 
                requestParts.push({ text: prompt });
            } else { 
                requestParts.push({ text: "Bu resimdeki LGS sorusunu ve seçeneklerini dikkatlice incele. Eğer varsa, altı çizili ifadeyi tespit et ve o ifadenin mecazi, eylemsel anlamını ve metinle ilişkisini derinlemesine analiz et. Doğru seçeneği belirle ve bu seçeneğin neden doğru, diğerlerinin neden yanlış veya eksik olduğunu, özellikle pasif/aktif veya genel/spesifik anlam farklarını vurgulayarak metinle ilişkilendirerek adım adım açıkla. Cevabını yukarıdaki LGS yorumlama stratejisine uygun olarak yapılandır." });
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
