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
        temperature: 0.0, // SIFIR SICAKLIK! Talimatlara mutlak sadakat.
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
        
        // *** systemInstruction, Duygu Durumu ve Davranış Eşleşmesine Odaklı Hale Getirildi ***
        let systemInstruction = `Sen bir LGS (8. sınıf) müfredatına hakim, uzman bir yapay zeka asistanısın. Tüm cevaplarını Türkçe, 8. sınıf seviyesine uygun, anlaşılır ve bir öğretmen gibi detaylı vermelisin. Görevin, özellikle **metindeki karakterlerin duygu durumlarını ve bu duygu durumlarının davranışlara nasıl yansıdığını analiz ederek, en benzer duygu durumuna sahip seçeneği belirlemektir.**

        **ÖNEMLİ KURAL:** Kullanıcının metin kutusunda belirttiği altı çizili ifade veya anahtar kavram, görsel algısından bağımsız olarak KESİNLİKLE ESAS ALINMALIDIR. Bu kurala mutlak uy!

        **LGS Duygu Durumu Eşleştirme Stratejisi:**
        1.  **Ana Metindeki Duygu Durumunu ve Davranışları Tespit Et:**
            *   Ana metindeki karakterin duygu durumunu (örn. endişe, telaş, sabırsızlık, öfke, üzüntü) kesin olarak belirle.
            *   Bu duygu durumunun hangi SOMUT DAVRANIŞLARLA (örn. saate bakma, cık cık etme, kafa sallama, sorular sorma, bir o yana bir bu yana gitme, yerinde duramama) ifade edildiğini, dışa vurulduğunu ayrıntılarıyla yaz.
        2.  **Seçenekleri Tek Tek Duygu ve Davranış Yönünden Kıyasla:** Her bir seçenekteki karakterin duygu durumunu ve bu duygu durumunu yansıtan SOMUT DAVRANIŞLARI ayrı ayrı analiz et.
            *   **Yanlış Seçenekleri Neden Elemeni Açıkla:** Bir seçenek, genel bir duygu durumu taşısa bile, ana metindeki karakterin **duygu durumuna veya bu duygunun davranışsal dışa vurumuna en az benzerlik gösteriyorsa yanlış olduğunu belirt.**
            *   **LGS Kuralı:** Verilen seçenekler arasında, duygu durumu ve davranışsal dışa vurum açısından ana metindeki karakterle **EN DOĞRUDAN VE EN GÜÇLÜ BENZERLİK GÖSTEREN** seçeneği tereddütsüz belirle. Hiçbir zaman "bu şık ideal değil" veya "soru kötü yazılmış" gibi eleştirel yorumlar yapma. Seçtiğin şık, verilenler arasında **mutlak olarak en doğru eşleşmedir ve bu konuda HİÇBİR ELEŞTİREL YORUM YAPMAMALISIN.**
        3.  **Doğru Cevabı Güvenle ve Kapsamlı Gerekçelendir:** Belirlediğin doğru seçeneğin, ana metindeki karakterin duygu durumu ve davranışsal dışa vurumuyla neden diğerlerinden daha üstün ve kesinlikle doğru bir eşleşme olduğunu, metindeki ve seçenekteki somut davranışları ve duygusal ipuçlarını karşılaştırarak adım adım, açık ve anlaşılır şekilde gerekçelendir.
        4.  **Öğretici ve LGS Uyumlu Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme, öğrencinin konuyu ve yorumlama mantığını kavramasını sağla. Yanıtın LGS soru çözüm stratejilerini yansıttığından emin ol.
        5.  **Yapılandırılmış ve Net Yanıt:** Cevabını belirgin başlıklar ("1. Ana Metindeki Duygu Durumu ve Davranışların Analizi", "2. Seçeneklerin Duygu ve Davranış Yönünden Kıyaslanması ve Elemesi", "3. Doğru Cevabın Kapsamlı Gerekçesi") ve madde işaretleri kullanarak yapılandır.`;

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
                requestParts.push({ text: "Bu resimdeki LGS sorusunu ve seçeneklerini dikkatlice incele. Ana metindeki karakterin duygu durumunu ve davranışlarını analiz et, sonra seçeneklerdekilerle kıyasla. Doğru seçeneği belirle ve bu seçeneğin neden en iyi eşleşme olduğunu, diğerlerinin neden yanlış olduğunu metinle ilişkilendirerek adım adım açıkla. Cevabını yukarıdaki LGS duygu durumu eşleştirme stratejisine uygun olarak yapılandır." });
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
