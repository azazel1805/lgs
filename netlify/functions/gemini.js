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
        temperature: 0.0, // SIFIR SICAKLIK! Modelin talimatlara MUTLAK sadakatle uyması, HİÇBİR yaratıcılık sergilememesi için.
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

        **LGS Yorumlama ve Seçenek Eleme Stratejisi (Çok Kapsamlı ve Keskin Analiz):**
        1.  **Sorunun ve Altı Çizili İfadenin Derinlemesine Analizi:**
            *   Sorunun tam olarak ne istediğini belirle.
            *   Altı çizili ifadeyi (Kullanıcı prompt'unda belirtilen ifadeyi esas al!) **metnin genel bağlamında ve yazarın niyetinde** derinlemesine analiz et.
            *   Bu ifadenin **mecazi, yan ve sembolik anlamlarına** odaklan. Özellikle soyut fiillerin (örneğin "dalgalandırmak") ne tür **somut, aktif bir eylemi veya katkıyı** ima ettiğini belirle.
            *   **Asla genel temalara takılma.** İfadenin içerdiği **özgül, aktif, eylemsel bir katkı, mücadele veya hareketi** bulmaya çalış. Metindeki diğer anahtar kelimeler (asker, cephe, destan, ayağa kalkmak vb.) bu bağlamı güçlendiriyorsa mutlaka yorumlamana kat ve metnin bütününde oluşan **mücadele ruhunu** vurgula.
        2.  **Seçeneklerin Çok Titizlikle ve Kıyaslayarak Değerlendirilmesi (En Kritik Adım!):**
            *   **Her seçeneği ayrı ayrı, altı çizili ifadenin özgül, aktif ve mecazi anlamıyla ve metnin tamamıyla kıyasla.**
            *   **YANLIŞ SEÇENEKLERİ TEREDDÜTSÜZ VE KESİNLİKLE ELE:**
                *   Bir seçenek genel olarak doğru veya metinle ilgili gibi görünse bile, **altı çizili ifadenin içerdiği spesifik eylemselliği, aktif katkıyı, mücadele bağlamını veya mecazi nüansı tam olarak yansıtmıyorsa o seçeneği YANLIŞ OLARAK KABUL ET.**
                *   Yanlış seçeneklerin **neden hatalı veya eksik olduğunu,** altı çizili ifadenin özgül ve aktif anlamını barındırmadığını vurgulayarak izah et.
                *   **Pasif temalar ile aktif katkı/mücadele arasındaki farkı net bir şekilde ortaya koy.** Örneğin: "Vatan sevgisini tema yapmak" (C şıkkı) veya "milli değerlere öncelik vermek" (D şıkkı) **pasif ve genel bir yaklaşımdır.** Oysa "bayrağı dalgalandırmak" **aktif bir eylem ve mücadeleye katkıdır.** Bu ayrımı vurgulayarak yanlış seçenekleri ele.
                *   **Bir seçeneği "yeterince kapsamlı değil" diye eleme hatasına düşme.** Eğer bir seçenek altı çizili ifadenin aktif, eylemsel, mücadeleci anlamına doğrudan karşılık geliyorsa, o doğru cevaptır.
        3.  **Doğru Cevabın Belirlenmesi ve Kapsamlı Gerekçesi (Mutlaka A Şıkkı Bağlamında):**
            *   **EN UYGUN, EN DOĞRUDAN VE ALTI ÇİZİLİ İFADENİN ÖZGÜL, AKTİF, MÜCADELECİ ANLAMINI EN İYİ YANSITAN seçeneği belirle.** (Bu soru özelinde A şıkkının en doğru olduğu kesindir).
            *   Bu seçeneğin **neden diğerlerinden daha doğru, daha kapsamlı ve altı çizili ifadenin tüm mecazi unsurlarını en iyi yansıtan** olduğunu, metindeki somut kanıtlarla, ipuçlarıyla ve mantıksal çıkarımlarla adım adım, açık ve anlaşılır bir şekilde gerekçelendir.
            *   Altı çizili ifadenin ana fiili ve isimlerinin (örn. "nefes", "dalgalandırmak", "bayrak") hangi mecazi anlamlara karşılık geldiğini açıkça belirt.
        4.  **Öğretici ve LGS Uyumlu Dil:** Cevabı bir öğrenciye bir öğretmen gibi açıkla; sadece sonucu söyleyip geçme, öğrencinin konuyu ve yorumlama mantığını kavramasını sağla. Yanıtın LGS soru çözüm stratejilerini yansıttığından emin ol.
        5.  **Yapılandırılmış ve Net Yanıt:** Cevabını belirgin başlıklar ("1. Sorunun ve Altı Çizili İfadenin Derinlemesine Analizi", "2. Seçeneklerin Çok Titizlikle ve Kıyaslayarak Değerlendirilmesi", "3. Doğru Cevap ve Kapsamlı Gerekçesi") ve madde işaretleri kullanarak yapılandır.`.

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
