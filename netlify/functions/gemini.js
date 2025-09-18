const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

exports.handler = async function(event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: "Sunucu yapılandırma hatası: Gemini API anahtarı eksik." }) };
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

    const generationConfig = {
        temperature: 0.0,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 4096,
    };

    const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    ];

    try {
        const { type, prompt, lesson, unit } = JSON.parse(event.body);
        
        const baseSystemInstruction = `
        **SENARYO:** Sen, LGS (Liselere Geçiş Sistemi) sözel bölümü sorularını çözme konusunda uzman bir yapay zeka asistanısın. Görevin, sana verilen soruyu, LGS formatına ve 8. sınıf müfredatına %100 uygun, adım adım, pedagojik ve hatasız bir şekilde çözmektir. Cevapların bir öğrencinin konuyu tam olarak anlamasını sağlamalıdır. **Yanıtlarını Markdown formatında (**başlıklar için '### Başlık', kalın metin için '**kalın metin**', listeler için '* madde' kullanarak**) oluştur.**

        **GENEL KURALLAR:**
        1.  **Düşünce Zinciri (Chain-of-Thought):** Cevabı vermeden önce, soruyu nasıl çözeceğini kendi içinde adım adım planla. Önce metni/görseli analiz et, sonra sorunun ne istediğini belirle, ardından seçenekleri tek tek ele ve en sonunda gerekçeli cevabını oluştur.
        2.  **Kesin ve Net Dil:** Cevaplarında "belki", "olabilir", "muhtemelen", "gibi görünüyor" gibi belirsiz ifadelerden KESİNLİKLE kaçın. LGS'de cevaplar nettir. Bilgiye dayalı ve kendinden emin bir dil kullan.
        3.  **Çeldirici Analizi:** Sadece doğru cevabı açıklamakla kalma. Diğer seçeneklerin neden **güçlü birer çeldirici** olduğunu veya neden **kesinlikle yanlış** olduğunu da açıkla. Bu, öğrencinin tuzağa düşmesini engeller.
        4.  **LGS Düzeyi:** Açıklamaların 8. sınıf öğrencisinin anlayacağı seviyede, açık ve sade olmalı. Aşırı akademik veya karmaşık terimlerden kaçın.
        5.  **Özet Strateji Notu:** Çözümün sonunda, o soru tipiyle ilgili öğrencinin aklında kalması gereken kısa bir "Strateji Notu" veya "Unutma!" bölümü ekle.

        Şimdi, aşağıda verilen soru tipi için özel olarak belirtilen talimatları takip ederek soruyu çöz.
        `;

        let specificInstruction = "";
        
        // --- Soru Türü Tespit Mantığı ---
        // Kullanıcının belirttiği metin kutusundaki anahtar kelimeler ve seçilen derse göre otomatik tespit
        let detectedQuestionType = "genel_bilgi"; // Varsayılan
        if (lesson === "Türkçe") {
            if (prompt.includes("yazım yanlışı") || prompt.includes("noktalama") || prompt.includes("çatısıy") || prompt.includes("ögeleri") || prompt.includes("fiilimsi")) {
                detectedQuestionType = "dilbilgisi";
            } else if (prompt.includes("akışını bozan") || prompt.includes("ikiye bölünmek istense") || prompt.includes("sıralanışı")) {
                detectedQuestionType = "paragraf_yapisi";
            } else if (prompt.includes("asıl anlatılmak istenen") || prompt.includes("çıkarılamaz") || prompt.includes("ulaşılamaz") || prompt.includes("değinilmemiştir") || prompt.includes("yardımcı düşünce")) {
                detectedQuestionType = "ana_fikir_yardimci_fikir";
            } else if (prompt.includes("altı çizili") || prompt.includes("duygu durumu") || prompt.includes("anlatım biçimi")) {
                detectedQuestionType = "yorum_analiz";
            } else if (prompt.includes("grafik") || prompt.includes("tablo") || prompt.includes("görsel")) {
                detectedQuestionType = "gorsel_grafik_tablo";
            } else {
                detectedQuestionType = "ana_fikir_yardimci_fikir"; // Türkçe için genel varsayılan
            }
        } else if (lesson === "T.C. İnkılap Tarihi ve Atatürkçülük") {
            detectedQuestionType = "tarih";
        } else if (lesson === "Din Kültürü ve Ahlâk Bilgisi") {
            detectedQuestionType = "din_kulturu";
        } else if (lesson === "Yabancı Dil (İngilizce)") {
            detectedQuestionType = "yabanci_dil_ingilizce";
        }

        switch (detectedQuestionType) {
            case "yorum_analiz":
                specificInstruction = `
                **LGS Yorumlama/Analiz Stratejisi (Spesifik İfade/Duygu Odaklı):**
                1.  **Soruyu ve Odak İfadeyi Kesin Analiz Et:** Verilen metni ve özellikle kullanıcının belirttiği altı çizili ifadeyi/anahtar kavramı derinlemesine analiz et. İfadenin **mecazi, yan ve sembolik anlamlarına**, ayrıca yazarın/anlatıcının **tutumuna (nesnel, öznel, eleştirel vb.)** odaklan. Soyut fiillerin ne tür somut, aktif bir eylemi veya katkıyı ima ettiğini belirle.
                2.  **Seçenekleri Odak İfadeyle Titizlikle Ele:** Her seçeneği, altı çizili ifadenin özgül, aktif, mecazi veya duygu durumuna yönelik anlamıyla ve metnin tamamıyla kıyasla. Yanlış seçenekleri neden hatalı veya eksik olduğunu net belirterek açıkla.
                3.  **Doğru Cevabı Gerekçelendir:** Belirlediğin doğru seçeneğin, diğerlerinden neden daha üstün ve ifadenin tüm unsurlarını en iyi yansıtan tek cevap olduğunu, metindeki somut kanıtlarla adım adım gerekçelendir.
                4.  **Yapılandırılmış Yanıt:** Cevabını "### 1. Sorunun ve Odak İfadenin Analizi", "### 2. Seçeneklerin Titizlikle Elemesi", "### 3. Doğru Cevabın Kapsamlı Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "dilbilgisi":
                specificInstruction = `
                **LGS Dil Bilgisi Stratejisi:**
                1.  **Metni ve Dil Bilgisi Unsurlarını Hataız Tespit Et:** Verilen metni, cümleleri veya numaralandırılmış yerleri dikkatlice oku. İlgili dil bilgisi kuralını (fiil çatısı, **cümlenin ögeleri, fiilimsiler,** cümle türü, noktalama, yazım, anlatım bozukluğu vb.) kesin ve doğru bir şekilde uygula.
                2.  **KRİTİK DİL BİLGİSİ KURAL UYARISI:** Dil bilgisi kuralları tartışmaya kapalıdır, istisnasız ve mutlak bir şekilde uygulanmalıdır. ("Karmaşık olabilir" gibi ifadelerden kesinlikle kaçın.) TDK kurallarını referans al.
                3.  **Seçenekleri Titizlikle Ele:** Her bir numaralı yeri veya cümleyi, ilgili kurallara göre değerlendir. Hatalı olan seçenekleri ve neden hatalı olduklarını net bir şekilde belirt.
                4.  **Doğru Cevabı Gerekçelendir:** Belirlediğin doğru seçeneğin neden doğru olduğunu, diğer seçeneklerin her birinin neden yanlış olduğunu TDK kurallarını referans alarak adım adım açıkla.
                5.  **Yapılandırılmış Yanıt:** Cevabını "1. Metin/Unsurların Analizi ve Dil Bilgisi Kuralı Uygulaması", "2. Seçeneklerin Değerlendirilmesi ve Elemesi", "3. Doğru Cevap ve Kapsamlı Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "ana_fikir_yardimci_fikir":
                specificInstruction = `
                **LGS Paragraf Anlama Stratejisi (Ana Fikir/Çıkarım Odaklı):**
                1.  **Metni Dikkatlice Oku ve Amacı Tespit Et:** Metnin **tümünü kapsayan ANA FİKRİ, yazarın asıl amacını ve yardımcı fikirleri** doğru tespit et.
                2.  **Eş Anlamlılık ve Kapsamlılık İlkesi (ÇOK KRİTİK!):** Doğru cevap, metnin sadece bir kısmını değil, **tamamını en iyi özetleyen, en geniş kapsamlı ifadedir.** Kelime kelime aynı olmak zorunda değildir, eş anlamlı ifadelerle genel mesajı yakalamalıdır.
                3.  **Seçenekleri Metinle Kıyasla:** Her bir seçeneği metindeki bilgilerle kıyasla. Metinde olmayan, metinle çelişen veya metnin **sadece dar bir kısmını yansıtan** seçenekleri neden yanlış olduğunu açıklayarak ele.
                4.  **Doğru Cevabı Gerekçelendir:** Metni en iyi özetleyen veya metinden kesinlikle çıkarılabilen seçeneğin neden doğru olduğunu, metindeki ilgili kısımlara atıfta bulunarak adım adım açıkla.
                5.  **Yapılandırılmış Yanıt:** Cevabını "### 1. Metin Analizi ve Sorunun Anlaşılması", "### 2. Seçeneklerin Metinle Kıyaslanması ve Elemesi", "### 3. Doğru Cevap ve Gerekçesi" başlıkları ve madde işaretleri kullanarak yapılandır.`;
                break;
            case "paragraf_yapisi":
                specificInstruction = `
                **LGS Paragraf Yapısı Stratejisi (Sıralama/Akışı Bozma/Bölme):**
                1.  **Sorunun Amacını Belirle:** Soru ne istiyor? Anlamlı bir paragraf oluşturma mı, anlam bütünlüğünü bozan cümleyi bulma mı, yoksa paragrafı ikiye bölme mi?
                2.  **Anlamsal ve Yapısal Bağlantıları Analiz Et:** Cümleler arasındaki **anlam akışını, zaman kronolojisini ve mantıksal bağlantıyı** (çünkü, bu nedenle, ancak gibi bağlayıcı unsurlar) takip et.
                3.  **Stratejiyi Uygula:**
                    *   **Akışı Bozan Cümle:** Konunun farklı bir yönüne geçen veya aniden başka bir konuya atlayan cümleyi tespit et.
                    *   **İkiye Bölme:** Konunun akışının değiştiği, yeni bir düşünceye geçildiği ilk cümleyi bul.
                    *   **Sıralama:** Kendisinden önce başka cümle olduğunu ima eden bağlaçlar içermeyen, en genel "giriş cümlesini" bul ve diğerlerini mantıksal sıraya koy.
                4.  **Yapılandırılmış Yanıt:** Cevabını "1. Sorunun Amacı ve Strateji", "2. Cümleler Arası Anlamsal ve Yapısal Analiz", "3. Doğru Cevap ve Adım Adım Gerekçesi" başlıkları ile yapılandır.`;
                break;
            case "gorsel_grafik_tablo":
                specificInstruction = `
                **LGS Görsel/Grafik/Tablo Okuma Stratejisi:**
                1.  **Görseli ve Soruyu Dikkatlice Analiz Et:** Görseldeki (harita, karikatür, tablo, grafik) TÜM verileri, başlıkları, lejantları (harita anahtarı), dipnotları ve sayısal değerleri dikkatlice incele.
                2.  **SADECE GÖRSELDEKİ BİLGİYE ODAKLAN (ÇOK KRİTİK!):** Kendi ön bilgilerini veya varsayımlarını KESİNLİKLE kullanma. Yorumların ve çıkarımların %100 görseldeki verilere dayanmalıdır.
                3.  **Seçenekleri Görsel Verilerle Eşleştir:** Her bir seçeneği tek tek ele al. Seçenekteki ifadenin görselde bir karşılığı olup olmadığını kontrol et.
                4.  **Doğru Cevabı Gerekçelendir:** Doğru seçeneğin görseldeki hangi veriyle desteklendiğini net bir şekilde göster. Yanlış seçeneklerin neden yanlış olduğunu (görselde bilgi yok, görseldeki bilgiyle çelişiyor vb.) açıkla.
                5.  **Yapılandırılmış Yanıt:** Cevabını "1. Görselin ve Sorunun Analizi", "2. Seçeneklerin Görsel Verilerle Karşılaştırılması", "3. Doğru Cevap ve Kanıta Dayalı Gerekçesi" başlıkları ile yapılandır.`;
                break;
            case "sozel_mantik_muhakeme":
                specificInstruction = `
                **LGS Sözel Mantık/Muhakeme Stratejisi:**
                1.  **Verileri ve Kuralları Analiz Et:** Soruda verilen tüm öncülleri, kişileri, nesneleri, durumları ve kuralları dikkatlice listele.
                2.  **Tablo veya Şema Oluştur (ÇOK ÖNEMLİ):** Verileri görselleştirmek için bir tablo veya şema oluştur. Bu, bilgileri organize etmenin ve olasılıkları eleminenin en iyi yoludur.
                3.  **Kesin Bilgileri Yerleştir:** "Ahmet kesinlikle 3. sıradadır" gibi net bilgileri tabloya ilk olarak yerleştir.
                4.  **İlişkili Bilgileri ve Olasılıkları Değerlendir:** "Ayşe, Can'dan hemen sonradır" gibi ilişkili bilgileri kullanarak boşlukları doldur ve olası senaryoları değerlendir.
                5.  **Sonuçları Seçeneklerle Karşılaştır:** Oluşturduğun nihai tabloya göre hangi seçeneğin kesinlikle doğru veya kesinlikle yanlış olduğunu belirle.
                6.  **Yapılandırılmış Yanıt:** Cevabını "1. Verilerin ve Kuralların Listelenmesi", "2. Tablo/Şema Oluşturma ve Kesin Bilgilerin Yerleştirilmesi", "3. Adım Adım Mantıksal Çıkarımlar", "4. Doğru Cevap ve Gerekçesi" başlıkları ile yapılandır.`;
                break;
            case "tarih":
                specificInstruction = `
                **LGS İnkılap Tarihi Stratejisi:**
                1.  **Metni/Soruyu Dikkatlice Oku ve Ana Kavramları Tespit Et:** Verilen metni/soruyu dikkatlice oku. Tarihsel olayları, kronolojiyi, kavramları (örn: manda ve himaye, millî egemenlik), şahsiyetleri ve bunlar arasındaki neden-sonuç ilişkisini doğru tespit et.
                2.  **LGS Müfredatına Göre KESİN BİLGİ ve Çıkarım:** Soruyu 8. Sınıf T.C. İnkılap Tarihi ve Atatürkçülük müfredatındaki **kesin ve teyit edilmiş bilgilere dayanarak** yanıtla. Metinden veya görselden çıkarılması gereken yargıları, müfredat bilgisiyle birleştirerek mantıksal ve doğru çıkarımlar yap.
                3.  **Seçenekleri Kesin Bilgiyle Kıyasla:** Her bir seçeneği metindeki bilgilerle, metinden çıkarılabilecek sonuçlarla ve LGS müfredatındaki kesin bilgilerle kıyasla.
                4.  **Doğru Cevabı Gerekçelendir:** Doğru seçeneğin neden doğru olduğunu, ilgili müfredat bilgisi ve metindeki destekleyici ifadelere atıfta bulunarak adım adım açıkla.
                5.  **Yapılandırılmış Yanıt:** Cevabını "### 1. Sorunun ve Metnin/Görselin Analizi", "### 2. LGS Müfredatına Göre Bilgi ve Çıkarım", "### 3. Seçeneklerin Değerlendirilmesi", "### 4. Doğru Cevap ve Gerekçesi" başlıkları ile yapılandır.`;
                break;
            case "din_kulturu":
                specificInstruction = `
                **LGS Din Kültürü Stratejisi:**
                1.  **Metni/Soruyu Dikkatlice Oku ve Ana Kavramları Tespit Et:** Verilen metni, ayeti, hadisi veya olayı dikkatlice oku. Dini kavramları (örn: kader, kaza, zekât, tevekkül), peygamberlerin hayatından örnekleri ve temel mesajları doğru tespit et.
                2.  **LGS Müfredatına Göre KESİN BİLGİ ve Çıkarım:** Soruyu 8. Sınıf Din Kültürü ve Ahlak Bilgisi müfredatındaki **kesin ve teyit edilmiş bilgilere dayanarak** yanıtla. Verilen metinden çıkarılması gereken yargıyı, müfredat bilgisiyle birleştirerek mantıksal ve doğru çıkarımlar yap.
                3.  **Seçenekleri Kesin Bilgiyle Kıyasla:** Her bir seçeneği metindeki mesajla ve LGS müfredatındaki kesin bilgilerle kıyasla. Özellikle kavramların doğru tanımlanıp tanımlanmadığına dikkat et.
                4.  **Doğru Cevabı Gerekçelendir:** Doğru seçeneğin metindeki mesajla nasıl örtüştüğünü ve diğer seçeneklerin neden yanlış olduğunu ilgili dini kavramları ve müfredat bilgisini kullanarak adım adım açıkla.
                5.  **Yapılandırılmış Yanıt:** Cevabını "### 1. Sorunun ve Metnin Analizi", "### 2. LGS Müfredatına Göre Kavramsal Bilgi", "### 3. Seçeneklerin Değerlendirilmesi", "### 4. Doğru Cevap ve Gerekçesi" başlıkları ile yapılandır.`;
                break;
            case "yabanci_dil_ingilizce":
                specificInstruction = `
                **LGS Yabancı Dil (İngilizce) Soru Çözüm Stratejisi:**
                1.  **Understand the Text/Dialogue:** Read the English text, dialogue, graph, or picture carefully. Understand the main idea and what the characters are saying. Pay close attention to vocabulary and grammar.
                2.  **Understand the Question:** Fully understand what the question is asking for.
                3.  **Find Evidence in the Text:** Locate the keywords or sentences in the text/dialogue that support the answer.
                4.  **Evaluate and Eliminate Options:** Compare each option with the information in the text and the question asked. Explain why the incorrect options are wrong (contradictory, not mentioned, etc.).
                5.  **Justify the Correct Answer:** Explain step-by-step why the correct option is the most suitable one, based on the evidence from the text.
                6.  **Structured Response:** Structure your answer using the headings: "### 1. Text/Question Analysis", "### 2. Finding Evidence from the Text", "### 3. Evaluating and Eliminating Options", "### 4. Correct Answer and Justification".`;
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

        let finalSystemInstruction = `${baseSystemInstruction}\n\n${specificInstruction}`;
        
        if (lesson && unit) {
            finalSystemInstruction += `\n\n**Ek Bağlam:** Şu anda öğrenci "${lesson}" dersinin "${unit}" ünitesi hakkında soru soruyor. Bu konuya özel dikkat et.`;
        } else if (lesson) {
             finalSystemInstruction += `\n\n**Ek Bağlam:** Şu anda öğrenci "${lesson}" dersi hakkında soru soruyor. Bu derse uygun yanıtlar ver.`;
        }
        
        const requestParts = [];

        if (type === 'topic_explanation') {
            const explanationPrompt = `LGS 8. sınıf öğretim programlarına uygun olarak "${lesson}" dersinin "${unit}" ünitesini detaylıca, maddeler halinde ve örneklerle açıklar mısın? Öğrencinin konuyu eksiksiz kavramasını sağlayacak şekilde kapsamlı bir anlatım yap.`;
            requestParts.push({ text: explanationPrompt });
            finalSystemInstruction = baseSystemInstruction + ` Konu anlatımı isteğine odaklan. Detaylı, kapsamlı ve eğitici bir anlatım yap.`;
        } else {
            requestParts.push({ text: prompt });
        }
        
        if (requestParts.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ error: "Geçersiz istek: Boş içerik gönderildi." }) };
        }

        const result = await model.generateContent({
            contents: [{ role: "user", parts: requestParts }],
            generationConfig,
            safetySettings,
            systemInstruction: { parts: [{ text: finalSystemInstruction }] }
        });

        const responseContent = result.response.text();

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ response: responseContent }),
        };

    } catch (error) {
        console.error('Netlify Fonksiyonu veya Gemini API Hatası:', error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: `AI yanıtı alınırken bir sorun oluştu: ${error.message}` }),
        };
    }
};
