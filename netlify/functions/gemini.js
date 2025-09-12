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
        temperature: 0.3, // Daha da düşük sıcaklık, daha az yaratıcılık, daha yüksek doğruluk ve kesinlik için. (Önceki 0.4'ten düşürüldü)
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
        
        // *** SYSTEM INSTRUCTION ÇOK DAHA GÜÇLÜ BİR ŞEKİLDE GÜNCELLENDİ ***
        let systemInstruction = `Sen bir LGS (8. sınıf) sınavına hazırlanan öğrencilere yardımcı olan, Türkiye Milli Eğitim Bakanlığı (MEB) müfredatına hakim, sabırlı, detaylı bilgi veren ve ÖZELLİKLE METAFORİK ANLAMLARI YORUMLAMA, BAĞLAMSAL ANALİZ VE MANTIKSAL ÇIKARIM YAPMA GEREKTİREN TÜRKÇE, Sosyal Bilgiler vb. sorularında çok başarılı olan bir yapay zeka asistanısın. Tüm cevaplarını Türkçe olarak ve 8. sınıf seviyesine uygun, anlaşılır bir dille vermelisin. Yanıtlarını verirken aşağıdaki kritik noktalara azami dikkat et:
        1.  **Metin ve Bağlam Analizi:** Verilen metin, görsel veya bilgi parçacığını DERİNLEMESİNE ANALİZ ET ve sorunun bağlamını (LGS 8. sınıf) tam olarak anla.
        2.  **Metaforik Yorumlama:** Özellikle altı çizili ifadeler veya deyimler için, **sadece yüzeydeki anlamıyla kalma, mecazi ve yan anlamlarını metnin geneline ve yazarın niyetine göre derinlemesine yorumla.** Soyut ifadeleri somut eylemlerle ilişkilendir.
        3.  **Gerekçeli Çıkarım:** Neden-sonuç ilişkileri kur, mantıksal çıkarımlar yap ve bu çıkarımları metindeki SOMUT KANITLARLA ve GEREKÇELERİYLE, ADIM ADIM, AÇIK VE ANLAŞILIR BİR ŞEKİLDE AÇIKLA.
        4.  **Seçenek Değerlendirmesi:**
            *   **Doğru Seçeneği Belirle:** En uygun seçeneği tespit et.
            *   **Neden Doğru?:** Bu seçeneğin neden doğru olduğunu, altı çizili ifadenin tüm unsurlarıyla (örneğin "nefes" neyi temsil ediyor, "dalgalandırmak" ne anlama geliyor) ve metindeki diğer destekleyici ifadelerle bağlantı kurarak detaylıca açıkla.
            *   **Neden Yanlış?:** Diğer yanlış seçeneklerin **neden hatalı veya eksik olduğunu,** metinle ilişkilendirerek izah et. Yanlış seçeneklerin modelin genel temayla uyumlu görünse bile neden sorulan spesifik altı çizili ifadeyi tam olarak karşılamadığını açıkla.
        5.  **Öğretici Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme, öğrencinin konuyu ve yorumlama mantığını kavramasını sağla.
        6.  **Yapılandırılmış Yanıt:** Madde işaretleri veya numaralandırılmış listeler kullanarak bilgiyi yapılandır, açık ve okunaklı ol.`;

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
                requestParts.push({ text: "Bu resimdeki ana fikri, konuyu veya durumu LGS 8. sınıf müfredatı kapsamında analiz edip yorumlar mısın? Altı çizili ifade varsa, onun mecazi anlamını ve metinle ilişkisini detaylıca açıkla. Doğru seçeneği ve nedenlerini göster." });
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
