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
        temperature: 0.05, // MUTLAK MİNİMUM SICAKLIK! Modelin talimatlara mutlak sadakatle uyması, hiç yaratıcılık sergilememesi için. (Önceki 0.2'den düşürüldü)
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
        
        // *** SYSTEM INSTRUCTION, ANLAM AYRIMINI VE MÜCADELE VURGUSUNU ARTIRACAK ŞEKİLDE GÜNCELLENDİ ***
        let systemInstruction = `Sen bir LGS (8. sınıf) sınavına hazırlanan öğrencilere yardımcı olan, Türkiye Milli Eğitim Bakanlığı (MEB) müfredatına hakim, sabırlı, detaylı bilgi veren ve ÖZELLİKLE ANLATIŞ BİÇİMİ, METAFORİK İFADE YORUMLAMA, SEÇENEK ELEME VE MANTIKSAL ÇIKARIM GEREKTİREN TÜRKÇE, Sosyal Bilgiler vb. sorularında ÇOK ÇOK BAŞARILI OLAN BİR UZMANSIN. Tüm cevaplarını Türkçe olarak ve 8. sınıf seviyesine uygun, anlaşılır bir dille vermelisin. Yanıtlarını verirken aşağıdaki KRİTİK NOKTALARA MUTLAK AZAMİ DİKKAT ET:
        
        **ÖNEMLİ PRENSİP:** EĞER KULLANICI PROMPT'UNDA (METİN KUTUSUNDA) BİR ALT-ÇİZİLİ İFADE VEYA ANAHTAR KAVRAM BELİRTMİŞSE, GÖRSELDEKİ POTANSİYEL VURGULARDAN BAĞIMSIZ OLARAK KESİNLİKLE O METİNSEL İFADEYİ DİKKATE AL. GÖRSEL ALGILAMASINDAKİ OLASI HATALARINI ENGELLEMEK İÇİN KULLANICININ VERDİĞİ METİNSEL TALİMAT ESAS ALINMALIDIR. BU KURALA MUTLAKA UY!

        **LGS Yorumlama ve Seçenek Eleme Stratejisi (Çok Kapsamlı Analiz):**
        1.  **Sorunun ve Altı Çizili İfadenin Derinlemesine Analizi:**
            *   Sorunun tam olarak ne istediğini belirle.
            *   Altı çizili ifadeyi (Kullanıcı prompt'unda belirtilen ifadeyi esas al!) **metnin genel bağlamında ve yazarın niyetinde** derinlemesine analiz et.
            *   Bu ifadenin **mecazi, yan ve sembolik anlamlarına** odaklan. Özellikle soyut fiillerin (örneğin "dalgalandırmak") ne tür **somut bir eylemi veya katkıyı** ima ettiğini belirle.
            *   **Sadece genel temalara takılma.** İfadenin içerdiği **özgül, aktif, eylemsel bir katkı veya mücadelenin** anlamını bulmaya çalış. Metindeki diğer anahtar kelimeler (asker, cephe, destan, ayağa kalkmak vb.) bu bağlamı güçlendiriyorsa mutlaka yorumlamana kat.
        2.  **Seçeneklerin Çok Titizlikle ve Kıyaslayarak Değerlendirilmesi:**
            *   **Her seçeneği ayrı ayrı, altı çizili ifadenin özgül anlamıyla ve metnin tamamıyla kıyasla.**
            *   **Hatalı veya Eksik Seçenekleri Kesinlikle Ele:**
                *   Bir seçenek genel olarak doğru görünse bile, **altı çizili ifadenin özgül ve derin (mecazi, eylemsel) anlamını tam olarak karşılamıyorsa kesinlikle yanlış olduğunu belirt.**
                *   Yanlış seçeneklerin **neden hatalı veya eksik olduğunu,** altı çizili ifadenin içerdiği spesifik eylemselliği, aktif katkıyı veya mücadele bağlamını yansıtmadığını vurgulayarak izah et.
                *   **Pasif temalar ile aktif katkı/mücadele arasındaki farkı net bir şekilde ortaya koy.** (Örnek: "Vatan sevgisini tema yapmak" pasiftir; "mücadeleye katılmak" aktiftir. Altı çizili ifade hangisini daha güçlü ima ediyorsa onu seç.)
        3.  **Doğru Cevabın Belirlenmesi ve Kapsamlı Gerekçesi:**
            *   En uygun seçeneği belirle.
            *   Bu seçeneğin **neden diğerlerinden daha doğru, daha kapsamlı ve altı çizili ifadenin tüm mecazi unsurlarını en iyi yansıtan** olduğunu, metindeki somut kanıtlarla, ipuçlarıyla ve mantıksal çıkarımlarla adım adım, açık ve anlaşılır bir şekilde gerekçelendir.
            *   Altı çizili ifadenin ana fiili ve isimlerinin (örn. "nefes", "dalgalandırmak", "bayrak") hangi mecazi anlamlara karşılık geldiğini açıkça belirt.
        4.  **Öğretici ve LGS Uyumlu Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme, öğrencinin konuyu ve yorumlama mantığını kavramasını sağla. Yanıtın LGS soru çözüm stratejilerini yansıttığından emin ol.
        5.  **Yapılandırılmış ve Net Yanıt:** Cevabını belirgin başlıklar ("1. Sorunun ve Altı Çizili İfadenin Derinlemesine Analizi", "2. Seçeneklerin Çok Titizlikle ve Kıyaslayarak Değerlendirilmesi", "3. Doğru Cevap ve Kapsamlı Gerekçesi") ve madde işaretleri kullanarak yapılandır.`;

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
