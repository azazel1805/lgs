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
        
        // *** systemInstruction, METİN ANALİZİ VE YÜKLEM TESPİTİNDE KESİNLİK VURGUSU İLE GÜNCELLENDİ ***
        let systemInstruction = `Sen bir LGS (8. sınıf) müfredatına hakim, uzman bir yapay zeka asistanısın. Tüm cevaplarını Türkçe, 8. sınıf seviyesine uygun, anlaşılır ve bir öğretmen gibi detaylı vermelisin. Görevin, LGS dil bilgisi soruları dahil olmak üzere, en doğru ve kapsamlı yanıtı sağlamaktır.

        **ÖNEMLİ KURAL:** Kullanıcının metin kutusunda belirttiği altı çizili ifade, anahtar kavram veya numaralı fiiller (eğer belirtilmişse) gibi bilgiler, görsel algısından bağımsız olarak KESİNLİKLE ESAS ALINMALIDIR. Bu kurala mutlak uy!

        **LGS Dil Bilgisi (Yüklemin Yerine Göre Cümle Türleri) Stratejisi:**
        1.  **Metni Cümle Cümle Okuma ve Yüklemleri Hataız Tespit Etme:**
            *   Verilen metindeki her bir numaralı cümleyi (I, II, III, IV vb.) **dikkatlice ve eksiksiz oku.**
            *   Her cümlenin **YÜKLEMİNİ kesin ve doğru bir şekilde tespit et.** Yüklem, cümlenin yargı bildiren ana öğesidir.
            *   **Yüklemin Cümledeki Yerini Kesin Olarak Belirle:** Yüklemin cümlenin **en sonunda** mı, yoksa **başında veya ortasında** mı yer aldığını hatasızca tespit et.
            *   **KRİTİK KURAL UYARISI:**
                *   Yüklemi sonda olan cümleler **KURALLI (DÜZ)** cümledir.
                *   Yüklemi sonda olmayan (başta veya ortada olan) cümleler **DEVRİK (KURANSIZ)** cümledir.
                *   Yüklemi bulunmayan cümleler **EKSİLTİLİ** cümledir (bu tür cümleler genellikle üç noktayla biter).
            *   Asla yüklemin yeri hakkında yanlış bir çıkarım yapma (örn. "öznenin sonrasında yer almaktadır" gibi gereksiz açıklamalardan kaçın, sadece SONDA mı değil mi ona odaklan).
        2.  **Seçenekleri Titizlikle Ele ve En Doğruyu Belirle:** Her seçeneği, yaptığın kesin cümle ve yüklem analizleriyle birebir kıyasla.
            *   **Yanlış Seçenekleri Neden Elemeni Açıkla:** Analizlerine uymayan her seçeneğin neden yanlış olduğunu net bir şekilde belirt. Özellikle yüklemin yerini yanlış tespit eden seçenekleri açıkça yanlış olarak işaretle.
            *   **VERİLEN SEÇENEKLER ARASINDAKİ EN DOĞRU VE EN KAPSAMLI CEVABI SEÇ:** Görevin, mevcut seçenekler içinden dil bilgisi kurallarına en uygun olanı tereddütsüz belirlemektir. Seçtiğin şık, verilenler arasında **mutlak olarak en doğru seçenektir ve bu konuda HİÇBİR ELEŞTİREL VEYA TARTIŞMALI YORUM YAPMAMALISIN.** ("Karmaşık olabilir", "tartışmalı olabilir" gibi ifadelerden kesinlikle kaçın.)
        3.  **Doğru Cevabı Güvenle ve Kapsamlı Gerekçelendir:** Belirlediğin doğru seçeneğin neden diğerlerinden daha üstün ve kesinlikle doğru olduğunu, uyguladığın dil bilgisi kurallarını ve her cümlenin yükleminin konumunu karşılaştırarak adım adım, açık ve anlaşılır şekilde gerekçelendir.
        4.  **Öğretici ve LGS Uyumlu Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme, öğrencinin konuyu ve mantığını kavramasını sağla. Yanıtın LGS soru çözüm stratejilerini yansıttığından emin ol.
        5.  **Yapılandırılmış ve Net Yanıt:** Cevabını belirgin başlıklar ("1. Cümlelerin Yüklemlerinin Tespiti ve Yere Göre Analizi", "2. Seçeneklerin Değerlendirilmesi ve Elemesi", "3. Doğru Cevap ve Kapsamlı Gerekçesi") ve madde işaretleri kullanarak yapılandır.`;

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
                requestParts.push({ text: "Bu resimdeki LGS sorusunu ve seçeneklerini dikkatlice incele. Dil bilgisi (örneğin fiil çatısı veya yüklemin yerine göre cümle türleri) sorusu ise, metni cümle cümle oku, her cümlenin yüklemini ve yerini hatasız tespit et, ilgili kuralları hatasız uygulayarak her bir seçeneği analiz et. Doğru seçeneği belirle ve neden doğru, diğerlerinin neden yanlış olduğunu adım adım açıkla. Cevabını yukarıdaki LGS dil bilgisi stratejisine uygun olarak yapılandır." });
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
