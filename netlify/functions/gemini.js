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
        const { type, prompt, image, lesson, unit, questionType } = JSON.parse(event.body);
        
        let baseSystemInstruction = `Sen bir LGS (8. sınıf) müfredatına hakim, uzman bir yapay zeka asistanısın. Tüm cevaplarını Türkçe, 8. sınıf seviyesine uygun, anlaşılır ve bir öğretmen gibi detaylı vermelisin. Görevin, LGS sorularında en doğru ve kapsamlı yanıtı sağlamaktır.

        **ÖNEMLİ KURALLAR:**
        1.  **Kullanıcı Prompt'una Mutlak Öncelik:** Kullanıcının metin kutusunda belirttiği altı çizili ifade, anahtar kavram veya numaralı fiiller (eğer belirtilmişse) gibi bilgiler, görsel algısından bağımsız olarak KESİNLİKLE ESAS ALINMALIDIR. Eğer kullanıcı bir SORU NUMARASI belirtmişse (örn. "4. soruyu çöz" gibi), görselde birden fazla soru olsa bile SADECE O SORUYA ODAKLAN! Bu kurallara mutlak uy!
        2.  **Sadece Doğruyu Seç (Veya Durumu Açıkla):** Kendi hesaplamaların veya analizlerin sonucunda bulduğun değer, seçeneklerdeki herhangi bir değerle tam olarak EŞLEŞMİYorsa, o zaman **KESİNLİKLE HİÇBİR SEÇENEĞİ İŞARETLEME.** Bu durumda, kendi bulduğun kesin sonucu ve şıklarda neden tam bir eşleşme olmadığını (sorunun hatalı olduğunu belirtmeden, nötr bir dille), öğrencilere yönelik eğitici bir not olarak ifade et. Hiçbir zaman "bu şık ideal değil", "soru kötü yazılmış" veya "seçeneklerde yok" gibi eleştirel yorumlar yapma. Görevin, mevcut seçenekler içinden en doğru olanı tereddütsüz belirlemektir. Seçtiğin şık, verilenler arasında mutlak olarak en doğru seçenektir.
        3.  **Matematiksel Eşdeğerlikleri Doğru Algıla:** Seçeneklerdeki matematiksel ifadelerin (üslü sayılar, köklü ifadeler, eşitsizlikler vb.) sayısal karşılıklarını hatasız hesapla ve senin bulduğun sonuçla tam olarak eşleşip eşleşmediğini kontrol et.`;

        let specificInstruction = "";

        // Seçilen soru türüne göre özel talimatları belirle
        switch (questionType) {
            case "yorum_analiz": // Altı çizili, duygu durumu, mecazi anlam vb.
                specificInstruction = `
                **LGS Yorumlama/Analiz Stratejisi (Spesifik İfade/Duygu Odaklı):**
                1.  **Soruyu ve Odak İfadeyi Kesin Analiz Et:** Verilen metni ve özellikle kullanıcının belirttiği altı çizili ifadeyi/anahtar kavramı derinlemesine analiz et. İfadenin **mecazi, yan ve sembolik anlamlarına** odaklan. Soyut fiillerin ne tür somut, aktif bir eylemi veya katkıyı ima ettiğini belirle. Genel temalardan ziyade, ifadenin **özgül, aktif, eylemsel veya duygu durumunu** metindeki ipuçlarıyla ilişkilendirerek bul. Metnin bütünündeki ana temayı değil, **odak ifadenin spesifik anlamını** vurgula.
                2.  **Seçenekleri Odak İfadeyle Titizlikle Ele:** Her seçeneği, altı çizili ifadenin özgül, aktif, mecazi veya duygu durumuna yönelik anlamıyla ve metnin tamamıyla kıyasla.
                    *   Yanlış seçenekleri neden hatalı veya eksik olduğunu, özellikle ifadenin spesifik anlamına tam karşılık gelmediğini, pasif (örn. tema yapmak) ile aktif (örn. mücadeleye katılmak) arasındaki farkı net belirterek açıkla. Doğru cevap, ifadenin spesifik anlamına EN DOĞRUDAN karşılık gelendir.
                3.  **Doğru Cevabı Gerekçelendir:** Belirlediğin doğru seçeneğin, diğerlerinden neden daha üstün ve altı çizili ifadenin tüm mecazi unsurlarını/duygu durumunu en iyi yansıtan, verilen seçenekler arasında kesinlikle doğru olan tek cevap olduğunu, metindeki somut kanıtlarla ve mantıksal çıkarımlarla adım adım, açık ve anlaşılır şekilde gerekçelendir.
                4.  **Yapılandırılmış Yanıt:** Cevabını "1. Sorunun ve Odak İfadenin Analizi", "2. Seçeneklerin Titizlikle Elemesi ve En Doğru Cevabın Belirlenmesi", "3. Doğru Cevabın Kapsamlı Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "dilbilgisi":
                specificInstruction = `
                **LGS Dil Bilgisi (Fiil Çatısı/Cümle Türleri/Yazım/Noktalama vb.) Stratejisi:**
                1.  **Metni ve Dil Bilgisi Unsurlarını Hataız Tespit Et:** Verilen metni, cümleleri veya kullanıcının belirttiği dil bilgisi unsurlarını (örn. numaralı fiiller, cümleler) dikkatlice ve eksiksiz oku. İlgili dil bilgisi kuralını (fiil çatısı, yüklemin yerine göre cümle türü, yazım, noktalama vb.) kesin ve doğru bir şekilde uygula.
                2.  **KRİTİK DİL BİLGİSİ KURAL UYARISI:** Dil bilgisi kuralları tartışmaya kapalıdır, istisnasız ve mutlak bir şekilde uygulanmalıdır. ("Karmaşık olabilir", "tartışmalı olabilir" gibi ifadelerden kesinlikle kaçın.)
                    *   **Edilgen Çatılı Fiiller:** Öznesine göre edilgen olan fiiller doğrudan nesne ALAMAZLAR ve bu nedenle nesnesine göre çatıları daima GEÇİŞSİZLERDİR. "Sözde özne" kavramını doğrudan nesne ile karıştırma.
                    *   **Yüklemin Yerine Göre Cümle:** Yüklemi sonda olan cümleler KURALLI (DÜZ). Yüklemi sonda olmayan (başta/ortada) cümleler DEVRİK (KURANSIZ). Yüklemi bulunmayan cümleler EKSİLTİLİ. Yüklemin yerini doğru tespit et.
                3.  **Seçenekleri Titizlikle Ele:** Her seçeneği, yaptığın kesin dil bilgisi analizleriyle birebir kıyasla. Yanlış seçenekleri neden hatalı olduğunu net açıkla.
                4.  **Doğru Cevabı Gerekçelendir:** Belirlediğin doğru seçeneğin neden diğerlerinden daha üstün ve kesinlikle doğru olduğunu, uyguladığın dil bilgisi kurallarını adım adım, açık ve anlaşılır şekilde gerekçelendir.
                5.  **Yapılandırılmış Yanıt:** Cevabını "1. Metin/Unsurların Analizi ve Dil Bilgisi Kuralı Uygulaması", "2. Seçeneklerin Değerlendirilmesi ve Elemesi", "3. Doğru Cevabın Kapsamlı Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "metin_okuma": // Ana fikir, yardımcı fikir, anlatım tekniği vb.
                specificInstruction = `
                **LGS Metin Okuma/Paragraf Anlama Stratejisi (Genel Anlam/Ana Fikir Odaklı):**
                1.  **Metni Dikkatlice Oku ve Ana Fikri/Amacı Tespit Et:** Verilen metni/paragrafı dikkatlice ve baştan sona oku. Metnin **tümünü kapsayan ANA FİKRİ, yazarın asıl amacını, yardımcı fikirleri ve anlatım tekniklerini** (benzetme, karşılaştırma vb.) doğru tespit et.
                2.  **Eş Anlamlılık ve Kapsamlılık İlkesi:** Ana fikri veya metinden çıkarılması istenen mesajı, **sadece kelime kelime eşleşme arayarak değil, eş anlamlı/yakın anlamlı ifadelerle metnin genelinde kastedilen ana mesajı yakalayarak belirle.** Doğru cevap, metnin tümünü en iyi özetleyen, en geniş kapsamlı ifadedir.
                3.  **Seçenekleri Metinle Kıyasla ve Kapsamlılığı Değerlendir:** Her bir seçeneği ayrı ayrı metindeki bilgilerle ve ana fikirle kıyasla.
                    *   **Yanlış Seçenekleri Ele:** Metinde olmayan, metinden çıkarılamayan, metinle çelişen veya metnin **sadece dar bir kısmını yansıtan (ana fikri karşılamayan)** seçenekleri neden yanlış olduğunu açıklayarak ele. Sadece bir metin parçasını özetleyen seçenekleri, daha kapsamlı bir seçenek varken doğru olarak seçme.
                4.  **Doğru Cevabı Gerekçelendir:** Metni en iyi özetleyen, soruyu en doğru şekilde karşılayan veya metinden kesinlikle çıkarılabilen seçeneği belirle. Bu seçeneğin neden doğru olduğunu, **kapsamlılığını ve metindeki tüm anahtar fikirlere nasıl karşılık geldiğini** göstererek, ilgili kısımlara atıfta bulunarak açıkla.
                5.  **Yapılandırılmış Yanıt:** Cevabını "1. Metin Analizi ve Sorunun Anlaşılması", "2. Seçeneklerin Metinle Kıyaslanması ve Elemesi", "3. Doğru Cevap ve Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "genel_bilgi":
            default: // Eğer tanımsız bir tür gelirse veya genel bilgi sorusuysa
                specificInstruction = `
                **LGS Genel Bilgi/Konu Anlatımı Stratejisi:**
                1.  **Soruyu Anla:** Sorunun hangi konu veya bilgi alanıyla ilgili olduğunu belirle.
                2.  **Detaylı ve Kapsamlı Bilgi:** İstenen bilgi veya kavram hakkında LGS müfredatına uygun, detaylı, doğru ve kapsamlı bir açıklama sun. Gerekirse örnekler ver.
                3.  **Yapılandırılmış Yanıt:** Bilgiyi madde işaretleri veya numaralı listeler kullanarak düzenle.`;
                break;
        }

        // Genel talimat ile seçilen türe özel talimatı birleştir
        let finalSystemInstruction = `${baseSystemInstruction}\n\n${specificInstruction}`;
        
        // Eğer ders ve ünite seçildiyse, bağlamı ekle
        if (lesson && unit) {
            finalSystemInstruction += ` Şu anda öğrenci "${lesson}" dersinin "${unit}" ünitesi hakkında bilgi alıyor veya soru soruyor. Bu konuya özel dikkat et.`;
        } else if (lesson) {
             finalSystemInstruction += ` Şu anda öğrenci "${lesson}" dersi hakkında bilgi alıyor veya soru soruyor. Bu derse uygun yanıtlar ver.`;
        }
        
        const requestParts = [];

        if (type === 'topic_explanation') { // Konu anlatımı isteği için ayrı bir yol
            const explanationPrompt = `LGS 8. sınıf müfredatına göre "${lesson}" dersinin "${unit}" ünitesini detaylıca, maddeler halinde ve örneklerle açıklar mısın? Öğrencinin konuyu eksiksiz kavramasını sağlayacak şekilde kapsamlı bir anlatım yap.`;
            requestParts.push({ text: explanationPrompt });
            finalSystemInstruction = baseSystemInstruction + ` Konu anlatımı isteğine odaklan. Detaylı, kapsamlı ve eğitici bir anlatım yap.`; // Konu anlatımı için sistem talimatını özelleştir
        } else { // Metin veya görsel soruları için
            requestParts.push({ text: prompt });
        }
        
        if (type === 'image' && image) {
            requestParts.push({
                inlineData: {
                    mimeType: "image/jpeg", 
                    data: image,
                },
            });
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
                parts: [{ text: finalSystemInstruction }]
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
