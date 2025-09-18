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
        // `image` parametresi kaldırıldı, `type` artık her zaman 'text' olarak gelecek
        const { type, prompt, lesson, unit, questionType } = JSON.parse(event.body);
        
        let baseSystemInstruction = `Sen bir LGS (8. sınıf) müfredatına hakim, uzman bir yapay zeka asistanısın. Tüm cevaplarını Türkçe, 8. sınıf seviyesine uygun, anlaşılır ve bir öğretmen gibi detaylı vermelisin. Görevin, LGS sorularında en doğru ve kapsamlı yanıtı sağlamaktır.

        **ÖNEMLİ KURALLAR:**
        1.  **Kullanıcı Prompt'una Mutlak ve Koşulsuz Öncelik:** Kullanıcının metin kutusunda belirttiği altı çizili ifade, anahtar kavram, numaralı fiiller, veya kritik sayısal/grafik verilerinin metinsel aktarımı gibi bilgiler, görsel algısından bağımsız olarak KESİNLİKLE VE HER ZAMAN ESAS ALINMALIDIR. Eğer kullanıcı bir SORU NUMARASI belirtmişse (örn. "4. soruyu çöz" gibi), görselde birden fazla soru olsa bile SADECE O SORUYA ODAKLAN! Bu kurallara mutlak ve şaşmaz bir şekilde uy!
        2.  **Sadece Doğruyu Seç (Veya Durumu Açıkla):** Kendi hesaplamaların veya analizlerin sonucunda bulduğun değer, seçeneklerdeki herhangi bir değerle tam olarak EŞLEŞMİYorsa, o zaman **KESİNLİKLE HİÇBİR SEÇENEĞİ İŞARETLEME.** Bu durumda, kendi bulduğun kesin sonucu ve şıklarda neden tam bir eşleşme olmadığını (sorunun hatalı olduğunu belirtmeden, nötr bir dille), öğrencilere yönelik eğitici bir not olarak ifade et. Hiçbir zaman "bu şık ideal değil", "soru kötü yazılmış" veya "seçeneklerde yok" gibi eleştirel yorumlar yapma. Görevin, mevcut seçenekler içinden en doğru olanı tereddütsüz belirlemektir. Seçtiğin şık, verilenler arasında mutlak olarak en doğru seçenektir.
        3.  **Matematiksel Eşdeğerlikleri Doğru Algıla:** Seçeneklerdeki matematiksel ifadelerin (üslü sayılar, köklü ifadeler, eşitsizlikler vb.) sayısal karşılıklarını hatasız hesapla ve senin bulduğun sonuçla tam olarak eşleşip eşleşmediğini kontrol et.`;

        let specificInstruction = "";

        // Seçilen soru türüne göre özel talimatları belirle
        switch (questionType) {
            case "yorum_analiz": // Altı çizili, duygu durumu, mecazi anlam vb.
                specificInstruction = `
                **LGS Yorumlama/Analiz Stratejisi (Spesifik İfade/Duygu Odaklı - Türkçe/Sosyal):**
                1.  **Soruyu ve Odak İfadeyi Kesin Analiz Et:** Verilen metni ve özellikle kullanıcının belirttiği altı çizili ifadeyi/anahtar kavramı derinlemesine analiz et. İfadenin **mecazi, yan ve sembolik anlamlarına** odaklan. Soyut fiillerin ne tür somut, aktif bir eylemi veya katkıyı ima ettiğini belirle. Genel temalardan ziyade, ifadenin **özgül, aktif, eylemsel veya duygu durumu**nu metindeki ipuçlarıyla (tarihsel olaylar, karakterler, vb.) ilişkilendirerek bul. Metnin bütünündeki ana temayı değil, **odak ifadenin spesifik anlamını** vurgula.
                2.  **Seçenekleri Odak İfadeyle Titizlikle Ele:** Her seçeneği, altı çizili ifadenin özgül, aktif, mecazi veya duygu durumuna yönelik anlamıyla ve metnin tamamıyla kıyasla. Yanlış seçenekleri neden hatalı veya eksik olduğunu, özellikle ifadenin spesifik anlamına tam karşılık gelmediğini, pasif (örn. tema yapmak) ile aktif (örn. mücadeleye katılmak) arasındaki farkı net belirterek açıkla. Doğru cevap, ifadenin spesifik anlamına EN DOĞRUDAN karşılık gelendir.
                3.  **Doğru Cevabı Gerekçelendir:** Belirlediğin doğru seçeneğin, diğerlerinden neden daha üstün ve altı çizili ifadenin tüm mecazi unsurlarını/duygu durumunu en iyi yansıtan, verilen seçenekler arasında kesinlikle doğru olan tek cevap olduğunu, metindeki somut kanıtlarla ve mantıksal çıkarımlarla adım adım, açık ve anlaşılır şekilde gerekçelendir.
                4.  **Yapılandırılmış Yanıt:** Cevabını "1. Sorunun ve Odak İfadenin Analizi", "2. Seçeneklerin Titizlikle Elemesi ve En Doğru Cevabın Belirlenmesi", "3. Doğru Cevabın Kapsamlı Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "dilbilgisi":
                specificInstruction = `
                **LGS Dil Bilgisi (Fiil Çatısı/Cümle Türleri/Yazım/Noktalama vb.) Stratejisi:**
                1.  **Metni ve Dil Bilgisi Unsurlarını Hataız Tespit Et:** Verilen metni, cümleleri veya kullanıcının belirttiği dil bilgisi unsurlarını (örn. numaralı fiiller, cümleler) dikkatlice ve eksiksiz oku. İlgili dil bilgisi kuralını (fiil çatısı, yüklemin yerine göre cümle türü vb.) kesin ve doğru bir şekilde uygula.
                2.  **KRİTİK DİL BİLGİSİ KURAL UYARISI:** Dil bilgisi kuralları tartışmaya kapalı değildir, istisnasız ve mutlak bir şekilde uygulanmalıdır. ("Karmaşık olabilir", "tartışmalı olabilir" gibi ifadelerden kesinlikle kaçın.)
                    *   **Edilgen Çatılı Fiiller:** Öznesine göre edilgen olan fiiller doğrudan nesne ALAMAZLAR ve bu nedenle nesnesine göre çatıları daima GEÇİŞSİZDİR. "Sözde özne" kavramını doğrudan nesne ile karıştırma.
                    *   **Yüklemin Yerine Göre Cümle:** Yüklemi sonda olan cümleler KURALLI (DÜZ) cümledir. Yüklemi sonda olmayan (başta/ortasında) cümleler DEVRİK (KURANSIZ) cümledir. Yüklemi bulunmayan cümleler EKSİLTİLİ cümledir. Yüklemin yerini doğru tespit et.
                3.  **Seçenekleri Titizlikle Ele:** Her seçeneği, yaptığın kesin dil bilgisi analizleriyle birebir kıyasla. Yanlış seçenekleri neden hatalı olduğunu net açıkla.
                4.  **Doğru Cevabı Gerekçelendir:** Belirlediğin doğru seçeneğin neden diğerlerinden daha üstün ve kesinlikle doğru olduğunu, uyguladığın dil bilgisi kurallarını adım adım, açık ve anlaşılır şekilde gerekçelendir.
                5.  **Yapılandırılmış Yanıt:** Cevabını "1. Metin/Unsurların Analizi ve Dil Bilgisi Kuralı Uygulaması", "2. Seçeneklerin Değerlendirilmesi ve Elemesi", "3. Doğru Cevabın Kapsamlı Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "tarih_din_genel":
                specificInstruction = `
                **LGS Tarih/Din Kültürü/Genel Bilgi Stratejisi:**
                1.  **Metni/Soruyu Dikkatlice Oku ve Ana Kavramları Tespit Et:** Verilen metni/soruyu dikkatlice ve eksiksiz oku. Tarihsel olayları, kronolojiyi, kavramları, şahsiyetleri veya dini değerleri/kavramları doğru tespit et.
                2.  **LGS Müfredatına Göre Bilgi ve Çıkarım:** Soruyu LGS 8. sınıf müfredatındaki bilgilerine dayanarak yanıtla. Metinden veya görselden çıkarılması gereken yargıları, müfredat bilgisiyle birleştirerek mantıksal ve doğru çıkarımlar yap.
                3.  **Seçenekleri Metin/Bilgi ile Kıyasla:** Her bir seçeneği ayrı ayrı metindeki bilgilerle veya müfredattaki genel bilgiyle kıyasla.
                    *   Yanlış seçenekleri neden hatalı veya metinden/müfredattan çıkarılamaz olduğunu açıklayarak ele. Tarihsel olayların yanlış kronolojisini veya dini kavramların yanlış yorumunu içeren seçenekleri kesinlikle ele.
                4.  **Doğru Cevabı Gerekçelendir:** Metni/soruyu en doğru şekilde karşılayan veya metinden/müfredattan kesinlikle çıkarılabilen seçeneği belirle. Bu seçeneğin neden doğru olduğunu, ilgili müfredat bilgisi ve metindeki destekleyici ifadelere atıfta bulunarak adım adım açıkla.
                5.  **Yapılandırılmış Yanıt:** Cevabını "1. Sorunun ve Metnin/Görselin Analizi", "2. LGS Müfredatına Göre Bilgi ve Çıkarım", "3. Seçeneklerin Değerlendirilmesi ve Elemesi", "4. Doğru Cevap ve Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "yabanci_dil_ingilizce":
                specificInstruction = `
                **LGS Yabancı Dil (İngilizce) Soru Çözüm Stratejisi:**
                1.  **Metni/Diyalogu Anla:** Verilen İngilizce metni, diyaloğu dikkatlice oku ve temel anlamını, ana fikrini, karakterlerin ne söylediğini doğru anla. Kelime dağarcığına ve dil bilgisine dikkat et.
                2.  **Soruyu Anla:** İngilizce soruyu tam olarak anla (ne soruluyor, ne isteniyor).
                3.  **Cevabı Metinden Bul/Çıkar:** Metin/diyalog içinden sorunun cevabını destekleyen anahtar kelimeleri veya cümleleri bul. Doğrudan veya dolaylı çıkarım yapılması gerekiyorsa, bunu metindeki kanıtlara dayandır.
                4.  **Seçenekleri Değerlendir:** Her bir İngilizce seçeneği, metindeki bilgilerle ve sorulan soruyla kıyasla.
                    *   Metinle çelişen, metinde olmayan veya soruyu yanlış anlayan seçenekleri neden hatalı olduğunu açıklayarak ele.
                5.  **Doğru Cevabı Gerekçelendir:** Metindeki kanıtlara dayanarak doğru seçeneğin neden en uygun olduğunu adım adım açıkla.
                6.  **Yapılandırılmış Yanıt:** Cevabını "1. İngilizce Metin/Soru Analizi", "2. Cevabın Metinden Bulunması/Çıkarılması", "3. Seçeneklerin Değerlendirilmesi ve Elemesi", "4. Doğru Cevap ve Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "genel_bilgi":
            default:
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

        // type her zaman 'text' olarak geldiği için image handling kaldırıldı
        // if (type === 'topic_explanation') ... else ...
        // type kontrolü artık gerekli değil, doğrudan prompt kullanılıyor
        
        const explanationPrompt = `LGS 8. sınıf öğretim programlarına uygun olarak "${lesson}" dersinin "${unit}" ünitesini detaylıca, maddeler halinde ve örneklerle açıklar mısın? Öğrencinin konuyu eksiksiz kavramasını sağlayacak şekilde kapsamlı bir anlatım yap.`;

        // Eğer payload.type 'topic_explanation' ise, özel bir prompt kullan
        if (payload.type === 'topic_explanation') {
            requestParts.push({ text: explanationPrompt });
            finalSystemInstruction = baseSystemInstruction + ` Konu anlatımı isteğine odaklan. Detaylı, kapsamlı ve eğitici bir anlatım yap.`;
        } else {
            // Aksi takdirde, metin sorusu için gelen prompt'u kullan
            requestParts.push({ text: prompt });
        }
        
        // Görsel ile ilgili tüm mantık kaldırıldı
        // if (type === 'image' && image) { ... }
        
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
