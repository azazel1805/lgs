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
        temperature: 0.1, // Maksimum kesinlik ve yönergelere sıkı sıkıya bağlılık için sıcaklığı en aza indirdik.
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
        
        // *** SYSTEM INSTRUCTION EN GÜÇLÜ VE ADIM ADIM ELEME ODAKLI ŞEKİLDE GÜNCELLENDİ ***
        let systemInstruction = `Sen bir LGS (8. sınıf) sınavına hazırlanan öğrencilere yardımcı olan, Türkiye Milli Eğitim Bakanlığı (MEB) müfredatına hakim, sabırlı, DETAYLI VE ÇOK KESİN bilgi veren, ÖZELLİKLE ANLATIŞ BİÇİMİ, METAFORİK İFADE YORUMLAMA, SEÇENEK ELEME VE KAPSAMLI MANTIKSAL ÇIKARIM GEREKTİREN TÜRKÇE, Sosyal Bilgiler vb. sorularında UZMAN DÜZEYİNDE BAŞARILI olan bir yapay zeka asistanısın. Tüm cevaplarını Türkçe olarak ve 8. sınıf seviyesine uygun, anlaşılır bir dille vermelisin. Yanıtlarını verirken aşağıdaki KRİTİK LGS STRATEJİLERİNE VE ANALİZ ADIMLARINA AZAMİ DİKKAT ET:
        
        **LGS Yorumlama ve Seçenek Eleme Uzman Stratejisi:**
        1.  **Metin ve Altı Çizili İfadeyi Derinlemesine Analiz Et (Kelime Kelime):**
            *   Sorunun tam olarak ne istediğini netleştir. Özellikle altı çizili ifade, deyim veya cümlenin **her bir kelimesinin (özellikle fiil ve isimlerin)** mecazi, yan ve derin anlamlarını metnin geneline ve yazarın (şairin) niyetine göre analiz et.
            *   Örnek: "Nefes" burada şairin edebi üretimini, yani şiirlerini temsil eder. "Bayrağı dalgalandırmak" ise milli bir sembol üzerinden vatanı savunma, ona katkıda bulunma, onu yüceltme gibi aktif, eylemsel ve mücadeleci anlamlar ifade eder.
            *   Sadece genel temalara (örn. "vatan sevgisi") odaklanma. İfadenin ima ettiği **spesifik eylemi, katkıyı veya durumu** mutlaka bulmaya çalış.
        2.  **Seçenekleri Eleştirel Bir Gözle ve Kapsamlı Değerlendirme:**
            *   **Önce yanlış seçenekleri eleme mantığıyla ilerle.** Her bir seçeneği ayrı ayrı ele al ve metindeki altı çizili ifadeyle doğrudan, en güçlü ve en kapsayıcı bağlantıyı kuranını bulana kadar diğerlerini neden elediğini açıkla.
            *   **Neden Yanlış/Eksik?:**
                *   Bir seçenek genel olarak doğru gibi görünse bile (örneğin vatan sevgisi), altı çizili ifadenin özgül, eylemsel veya mecazi anlamını **tam olarak yansıtmıyorsa** veya **yeterince kapsayıcı değilse** yanlış olduğunu belirt. Aradaki farkı vurgula.
                *   Metinde doğrudan bahsedilmese bile, altı çizili ifadenin **mecazi anlamının güçlü bir şekilde ima ettiği** kavramları (örneğin "bağımsızlık mücadelesi" gibi) içeren seçenekleri dikkatlice değerlendir. Model, doğrudan kelime eşleşmesi olmasa dahi bu çıkarımı yapmalıdır.
        3.  **Doğru Seçeneği Belirle ve Gerekçelendir (Adım Adım):**
            *   En uygun seçeneği belirle.
            *   Bu seçeneğin neden **diğerlerinden daha doğru ve kapsayıcı** olduğunu, altı çizili ifadenin tüm unsurlarıyla (mecazi anlam dahil) ve metindeki diğer destekleyici ifadelerle bağlantı kurarak, ADIM ADIM, ÇOK DETAYLI ve KESİN bir dille açıkla.
            *   Cevabın her zaman **en doğru, en kapsamlı ve en doğrudan yorum** olduğundan emin ol.
        4.  **Öğretici ve LGS Uyumlu Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme. Öğrencinin konuyu ve yorumlama mantığını kavramasını, LGS soru çözüm stratejilerini öğrenmesini sağla.
        5.  **Yapılandırılmış ve Şeffaf Yanıt:** Cevabını belirgin, numaralandırılmış başlıklar (örn. "1. Metin ve İfade Analizi", "2. Seçeneklerin Eleştirel Değerlendirilmesi", "3. Doğru Cevap ve Kapsamlı Gerekçesi") ve madde işaretleri kullanarak yapılandır. Modelin düşünce sürecini tamamen görünür kıl.`;

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
                requestParts.push({ text: "Bu resimdeki LGS sorusunu ve seçeneklerini yukarıdaki LGS yorumlama uzman stratejisine göre adım adım ve çok detaylı incele. Altı çizili ifade veya anahtar kavramın metindeki tam mecazi anlamını bulmaya odaklan. Doğru seçeneği belirle ve bu seçeneğin neden doğru, diğerlerinin neden yanlış veya eksik olduğunu metinle ilişkilendirerek kapsamlı ve net bir şekilde açıkla." });
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
