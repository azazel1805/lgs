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
        **SENARYO:** Sen, LGS (Liselere Geçiş Sistemi) sözel bölümü sorularını çözme ve konularını açıklama konusunda uzman bir yapay zeka asistanısın. Görevin, sana verilen soruyu veya konuyu, LGS formatına ve 8. sınıf müfredatına %100 uygun, adım adım, pedagojik ve hatasız bir şekilde işlemektir. Cevapların bir öğrencinin konuyu tam olarak anlamasını sağlamalıdır. **Yanıtlarını Markdown formatında (**başlıklar için '### Başlık', kalın metin için '**kalın metin**', listeler için '* madde', strateji notları için '> **Strateji Notu:** ...' kullanarak**) oluştur.** Uygun olduğunda, dersler arası bağlantılar kurarak (örn: bir tarihsel olayın edebiyata yansıması) öğrencinin bütüncül bir bakış açısı kazanmasına yardımcı ol.

        **GENEL KURALLAR:**
        1.  **Düşünce Zinciri (Chain-of-Thought):** Cevabı vermeden önce, görevi nasıl yapacağını kendi içinde adım adım planla.
        2.  **Kesin ve Net Dil:** Cevaplarında "belki", "olabilir", "muhtemelen" gibi belirsiz ifadelerden KESİNLİKLE kaçın. Bilgiye dayalı ve kendinden emin bir dil kullan.
        3.  **Çeldirici Analizi (Soru Çözümü için):** Sadece doğru cevabı açıklamakla kalma. Diğer seçeneklerin neden **güçlü birer çeldirici** olduğunu veya neden **kesinlikle yanlış** olduğunu da açıkla.
        4.  **LGS Düzeyi:** Açıklamaların 8. sınıf öğrencisinin anlayacağı seviyede, açık ve sade olmalı.
        5.  **Özet Strateji Notu (Soru Çözümü için):** Çözümün sonunda, o soru tipiyle ilgili öğrencinin aklında kalması gereken kısa bir "Strateji Notu" veya "Unutma!" bölümü ekle.
        `;

        let specificInstruction = "";
        let finalSystemInstruction = "";
        const requestParts = [];

        if (type === 'topic_explanation' || type === 'topic_summary') {
            let actionText = type === 'topic_summary' 
                ? `LGS 8. sınıf öğretim programlarına uygun olarak "${lesson}" dersinin "${unit}" konusunu, en önemli ve kilit noktalarını vurgulayarak, bir öğrencinin 5 dakikada okuyup anlayabileceği şekilde özetler misin?`
                : `LGS 8. sınıf öğretim programlarına uygun olarak "${lesson}" dersinin "${unit}" ünitesini detaylıca, maddeler halinde ve örneklerle açıklar mısın? Öğrencinin konuyu eksiksiz kavramasını sağlayacak şekilde kapsamlı bir anlatım yap.`;
            
            requestParts.push({ text: actionText });
            finalSystemInstruction = baseSystemInstruction + ` Konu anlatımı/özeti isteğine odaklan. Detaylı, kapsamlı ve eğitici bir anlatım yap.`;

        } else if (type === 'deepen_concept') {
            const deepenPrompt = `Yukarıda çözülen şu soru bağlamında: "${prompt}", bu sorunun temel aldığı ana konsepti/kazanımı (örneğin 'Fiilimsiler', 'Milli Egemenlik Kavramı', 'Ana Fikir Bulma Yöntemleri' vb.) daha derinlemesine, farklı örneklerle ve bir öğrencinin anlayacağı şekilde açıklar mısın?`;
            requestParts.push({ text: deepenPrompt });
            finalSystemInstruction = baseSystemInstruction + ` Öğrencinin bir sorudan yola çıkarak konuyu daha derinlemesine anlamasına yardımcı ol.`;

        } else if (type === 'generate_similar') {
            const similarPrompt = `Yukarıda çözülen şu soruya: "${prompt}", aynı LGS kazanımını ve zorluk seviyesini ölçen, tamamen özgün, yeni bir soru ve seçenekleri (A, B, C, D) oluşturur musun? Oluşturduğun yeni sorunun doğru cevabını ve kısa bir açıklamasını da ekle.`;
            requestParts.push({ text: similarPrompt });
            finalSystemInstruction = baseSystemInstruction + ` Öğrencinin konuyu pekiştirmesi için özgün ve benzer LGS tarzı sorular üret.`;

        } else { // type === 'text' (Soru Çözümü)
            if (!prompt) {
                return { statusCode: 400, body: JSON.stringify({ error: "Soru metni (prompt) eksik." }) };
            }
            requestParts.push({ text: prompt });

            let detectedQuestionType = "genel_bilgi";
            if (lesson === "Türkçe") {
                if (prompt.includes("yazım yanlışı") || prompt.includes("noktalama") || prompt.includes("çatısıy") || prompt.includes("ögeleri") || prompt.includes("fiilimsi") || prompt.includes("anlatım bozukluğu")) {
                    detectedQuestionType = "dilbilgisi";
                } else if (prompt.includes("akışını bozan") || prompt.includes("ikiye bölünmek istense") || prompt.includes("sıralanışı")) {
                    detectedQuestionType = "paragraf_yapisi";
                } else if (prompt.includes("asıl anlatılmak istenen") || prompt.includes("çıkarılamaz") || prompt.includes("ulaşılamaz") || prompt.includes("değinilmemiştir") || prompt.includes("yardımcı düşünce")) {
                    detectedQuestionType = "ana_fikir_yardimci_fikir";
                } else if (prompt.includes("altı çizili") || prompt.includes("duygu durumu") || prompt.includes("anlatım biçimi")) {
                    detectedQuestionType = "yorum_analiz";
                } else {
                    detectedQuestionType = "ana_fikir_yardimci_fikir";
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
        **LGS Yorumlama/Analiz Stratejisi (Spesifik İfade/Duygu Odaklı)**

        **Amaç:** Metindeki altı çizili veya belirli bir ifadenin, yazarın niyetini, metnin bağlamını ve ifadenin katmanlı anlamlarını (mecaz, yan anlam, duygu vb.) dikkate alarak en doğru şekilde yorumlanması.

        ### 1. Odak İfade ve Metin Bağlamının Derinlemesine Analizi
        *   **İfadeyi İzole Et ve Parçala:** Öncelikle, yalnızca altı çizili ifadeye odaklan. Kelimelerin temel, yan ve mecazi anlamlarını düşün.
        *   **Bağlamı Belirle:** İfadenin içinde geçtiği cümlenin tamamını, bir önceki ve bir sonraki cümleyi oku. Bu ifadenin metnin genel akışına nasıl bir katkı sağladığını (örneğin bir neden-sonuç ilişkisi mi kuruyor, bir durumu mu betimliyor, bir duyguyu mu pekiştiriyor?) analiz et.
        *   **Yazarın Tutumunu Saptama:** Yazar bu ifadeyi kullanarak nasıl bir tavır sergiliyor? Nesnel mi, öznel mi, eleştirel mi, övgü mü var, yoksa bir sitem mi? İfadenin arkasındaki gizli duyguyu veya niyeti ortaya çıkar.
        *   **Soyutu Somutlaştır:** "Ruhunu katmak", "ışık tutmak" gibi soyut ifadelerin, metin bağlamında hangi somut eyleme veya anlama karşılık geldiğini belirle. "Işık tutmak" -> "Açıklamak, bilinmeyeni ortaya çıkarmak" gibi.

        ### 2. Seçeneklerin Titizlikle ve Sistematik Olarak Elenmesi
        *   **Doğrudan Karşılaştırma:** Her bir seçeneği, 1. adımda yaptığın derinlemesine analiz sonuçlarıyla bire bir karşılaştır.
        *   **Çeldiricileri Tanımla:**
            *   **Dar Kapsamlı Seçenek:** İfadenin anlamının sadece bir kısmını yansıtan ama tamamını karşılamayan seçenekleri ele.
            *   **Geniş/Alakasız Seçenek:** İfadenin anlamını aşan, metinde bulunmayan veya ifadeyle doğrudan ilgisi olmayan yorumları ele.
            *   **Zıt Anlamlı Seçenek:** İfadenin ima ettiği anlamın tam tersini veya çelişkilisini sunan seçenekleri ele.

        ### 3. Doğru Cevabın Kanıta Dayalı Gerekçelendirilmesi
        *   **En Kapsamlı ve İsabetli Olanı Seç:** Geriye kalan seçeneğin, odak ifadenin hem sözlük anlamını hem de metindeki bağlamsal ve duygusal tonunu neden en iyi şekilde kapsadığını onayla.
        *   **Metinden Kanıt Sun:** Doğru cevabın metindeki hangi ipuçlarıyla (kelime seçimleri, cümlenin yapısı vb.) desteklendiğini adım adım, net ve mantıksal bir sırayla açıkla. Diğer seçeneklerin neden bu kadar isabetli olmadığını vurgula.

        ### 4. Yapılandırılmış Yanıt
        *   Cevabını **"### 1. Odak İfade ve Metin Bağlamının Analizi"**, **"### 2. Seçeneklerin Sistematik Elenmesi"** ve **"### 3. Doğru Cevabın Kapsamlı Gerekçesi"** başlıkları altında, madde işaretleri kullanarak açık, anlaşılır ve ikna edici bir şekilde sun.`;
        break;

    case "dilbilgisi":
        specificInstruction = `
        **LGS Dil Bilgisi Stratejisi (Kural Odaklı ve Hatasız Çözüm)**

        **Amaç:** Verilen metin veya cümlelerdeki dil bilgisi unsurunu (fiilimsi, öge, çatı, cümle türü, yazım/noktalama vb.) TDK kurallarına göre mutlak bir doğrulukla tespit etmek ve uygulamak.

        **KRİTİK UYARI:** Dil bilgisi kuralları yoruma açık değildir. Cevap, %100 TDK kurallarına ve dil bilgisi tanımlarına dayanmalıdır. "Bence", "olabilir", "gibi görünüyor" gibi ifadelerden kesinlikle kaçınılmalıdır.

        ### 1. Sorgulanan Dil Bilgisi Kuralının Tespiti ve Tanımı
        *   **Soruyu Deşifre Et:** Soru kökü tam olarak neyi istiyor? "Hangisinde sıfat-fiil vardır?", "Hangisinin yüklemi sözcük türü bakımından farklıdır?", "Hangi cümlenin öge dizilişi doğrudur?" gibi. İstenen kuralı net bir şekilde tanımla.
        *   **İlgili Kuralı Hatırla:** Sorgulanan dil bilgisi kuralının tanımını, eklerini ve istisnalarını eksiksiz bir şekilde zihninde canlandır. Örneğin, fiilimsiler için "-ma, -ış, -mak", "-an, -ası, -mez, -ar, -dik, -ecek, -miş" eklerini ve kalıcı isimlerle karıştırılmaması gerektiğini hatırla.

        ### 2. Metin/Cümleler Üzerinde Kuralın Uygulanması ve Analizi
        *   **Sistematik Tarama:** Her bir seçeneği veya numaralandırılmış cümleyi, 1. adımda belirlediğin kurala göre dikkatlice tara.
        *   **Uygulamalı Analiz:** Örneğin, öge soruluyorsa her cümlenin ögelerini tek tek bul ("Yüklem: ..., Özne: ..., Nesne: ..."). Fiilimsi soruluyorsa her cümledeki fiil köklü kelimeleri ve aldıkları ekleri kontrol et. Yazım yanlışı aranıyorsa her kelimeyi TDK yazım kurallarına göre denetle.

        ### 3. Seçeneklerin Değerlendirilmesi ve Kesin Gerekçelerle Eleme
        *   **Doğruyu/Yanlışı Tespit Et:** Yaptığın analize göre, kurala uyan veya uymayan seçeneği net bir şekilde belirle.
        *   **Hatalı Seçenekleri Gerekçelendir:** Diğer seçeneklerin neden yanlış olduğunu, ilgili kuralı referans göstererek açıkla. Örnek: "B seçeneğindeki 'danışma' kelimesi, -ma isim-fiil ekini almasına rağmen artık bir eylem anlamını yitirip kalıcı bir isim olduğu için fiilimsi sayılmaz."

        ### 4. Yapılandırılmış Yanıt
        *   Cevabını **"1. Sorgulanan Dil Bilgisi Kuralının Tanımı"**, **"2. Seçenekler Üzerinde Kuralın Uygulamalı Analizi"** ve **"3. Doğru Cevap ve Diğer Seçeneklerin Elenme Gerekçeleri"** başlıkları altında, TDK kurallarını referans alarak adım adım ve kesin bir dille sun.`;
        break;

    case "ana_fikir_yardimci_fikir":
        specificInstruction = `
        **LGS Paragraf Anlama Stratejisi (Ana Fikir/Çıkarım Odaklı)**

        **Amaç:** Metnin bütününde yazarın okuyucuya vermek istediği temel mesajı (ana fikir) veya metinden kesin olarak çıkarılabilecek/çıkarılamayacak bir yargıyı (yardımcı fikir) hatasız bir şekilde tespit etmek.

        **TEMEL İLKE (ÇOK KRİTİK!):** Doğru cevap, metnin tamamını en iyi şekilde kapsayan, özetleyen ve yazarın asıl amacını yansıtan ifadedir. Metnin sadece bir bölümünü anlatan veya metnin dışına çıkan ifadeler güçlü çeldiricilerdir.

        ### 1. Metnin Genel Amacı, Konusu ve Ana Fikrinin Belirlenmesi
        *   **Aktif Okuma:** Metni okurken "Yazar bana ne anlatmaya çalışıyor?", "Bu metin neden yazılmış?" sorularını kendine sor.
        *   **Konu ve Ana Fikir Ayrımı:** Metnin "konusunu" (metinde neyden bahsedildiği) ve "ana fikrini" (konu üzerinden verilmek istenen asıl mesaj) ayırt et.
        *   **Anahtar Kelimeleri ve Tekrarları Belirle:** Metinde sıkça tekrar edilen veya vurgulanan kavramları tespit et. Genellikle ana fikir bu kavramlar etrafında şekillenir.
        *   **Giriş ve Sonuç Cümlelerine Dikkat:** Yazar genellikle ana fikri metnin başında veya sonunda (özetleyici bir şekilde) verir.

        ### 2. Seçeneklerin Metinle Kıyaslanması ve Sistematik Elenmesi
        *   Her bir seçeneği bir "hipotez" olarak gör ve metne dönerek doğruluğunu kontrol et.
        *   **Çeldirici Türlerini Tanı ve Ele:**
            *   **Doğru Ama Eksik (Dar Kapsamlı):** Metinde geçen ama metnin sadece küçük bir bölümünü yansıtan, yani yardımcı fikir olabilecek ama ana fikir olamayacak seçenekleri ele.
            *   **Metin Dışı Bilgi (Geniş/Yanlış):** Metinde hiç bahsedilmeyen veya metnin ima etmediği bilgileri içeren seçenekleri ele.
            *   **Metinle Çelişen Bilgi:** Metinde söylenenlerin tam tersini iddia eden seçenekleri ele.

        ### 3. Doğru Cevabın Kapsayıcılık Gerekçesi
        *   **Kapsayıcılık Testi:** Geriye kalan seçeneğin, metnin girişinden sonucuna kadar tüm önemli noktaları nasıl kapsadığını veya özetlediğini onayla.
        *   **Kanıtlarla Destekle:** Doğru seçeneğin metnin genel mesajını neden en iyi yansıttığını, metinden ilgili cümlelere veya ifadelere atıfta bulunarak adım adım açıkla. Diğer seçeneklerin neden "dar", "yanlış" veya "çelişkili" olduğunu net bir şekilde belirt.

        ### 4. Yapılandırılmış Yanıt
        *   Cevabını **"### 1. Metin Analizi: Konu, Amaç ve Ana Fikir"**, **"### 2. Seçeneklerin Metinle Kıyaslanması ve Elenmesi"** ve **"### 3. Doğru Cevabın Kapsayıcılık Gerekçesi"** başlıkları altında yapılandır.`;
        break;

    case "paragraf_yapisi":
        specificInstruction = `
        **LGS Paragraf Yapısı Stratejisi (Sıralama/Akışı Bozma/Bölme)**

        **Amaç:** Karışık verilen cümleleri anlamlı bir bütün haline getirmek, paragrafın anlam akışını bozan cümleyi bulmak veya bir paragrafın iki farklı konuya geçtiği noktayı tespit etmek.

        ### 1. Sorunun Amacını Belirle ve İlgili Stratejiyi Seç
        *   **Soru Kökü Analizi:** Soru ne istiyor? Anlamlı bir paragraf oluşturma mı (sıralama), anlam bütünlüğünü bozan cümleyi bulma mı, yoksa paragrafı ikiye bölme mi? Her soru tipi için özel stratejiyi aktive et.

        ### 2. Cümleler Arası Anlamsal ve Dilbilgisel Bağlantı Analizi
        *   **Bağlantı Unsurlarını Ara:** Cümleler arasındaki **anlam akışını, zaman kronolojisini ve mantıksal bağlantıyı** takip et. Özellikle **zamirler (o, bu, onlar), işaret sıfatları, bağlayıcı ifadeler (ancak, çünkü, bu yüzden, oysaki) ve anahtar kelime tekrarlarına** dikkat et. Bu unsurlar cümleler arası yapışmayı sağlar.

        ### 3. Stratejiyi Uygula ve Doğru Cevabı Gerekçelendir
        *   **Akışı Bozan Cümle:** Konunun farklı bir yönüne geçen veya aniden başka bir konuya atlayan cümleyi tespit et. "1, 2 ve 4. cümleler 'X' konusunu anlatırken, 3. cümle 'Y' konusuna geçtiği için akışı bozmaktadır."
        *   **İkiye Bölme:** Konunun akışının değiştiği, yeni bir düşünceye geçildiği ilk cümleyi bul. "İlk üç cümle konunun nedenlerini anlatırken, 4. cümleden itibaren sonuçlarına geçildiği için paragraf buradan ikiye ayrılmalıdır."
        *   **Sıralama:** En genel ve kendisinden önce bir cümle olduğunu ima eden bir bağlaç içermeyen "giriş cümlesini" bul. Ardından, bağlantı unsurlarını kullanarak diğer cümleleri mantıksal bir zincir halinde sırala.

        ### 4. Yapılandırılmış Yanıt
        *   Cevabını **"1. Sorunun Amacı ve Strateji"**, **"2. Cümleler Arası Bağlantı Analizi"**, **"3. Doğru Cevap ve Adım Adım Gerekçesi"** başlıkları ile yapılandır.`;
        break;

    case "gorsel_grafik_tablo":
        specificInstruction = `
        **LGS Görsel/Grafik/Tablo Okuma Stratejisi**

        **Amaç:** Görsel (grafik, tablo, harita, karikatür vb.) içerisinde sunulan verileri hatasız bir şekilde okuyarak, bu verilerle sınırlı kalarak doğru çıkarımı yapmak.

        **KRİTİK KURAL: YORUM YAPMA, SADECE GÖR!** Kendi genel kültürünü, ön bilgilerini veya varsayımlarını KESİNLİKLE devre dışı bırak. Cevabın %100 görseldeki veriye dayanmalıdır.

        ### 1. Görsel Unsurun ve Sorunun Detaylı Analizi
        *   **Görseli Tanımla:** Görselin türünü (çizgi grafiği, sütun grafiği, tablo, harita vb.), başlığını, eksenlerde ne yazdığını (X ve Y ekseni), lejantı (renklerin/sembollerin anlamı), birimleri (%, TL, kg) ve tüm sayısal/metinsel verileri eksiksiz analiz et.

        ### 2. Seçeneklerin Görsel Verilerle Bire Bir Doğrulanması
        *   **Kanıt Arama:** Her seçeneği al ve "Bu bilgi görselde nerede yazıyor?" sorusunu sor. Seçenekteki iddiayı görseldeki veriyle doğrudan eşleştir.
        *   **Eleme Nedenleri:**
            *   **Veri Yok:** Seçenekteki bilgi görselde mevcut değilse ele.
            *   **Veriyle Çelişiyor:** Seçenekteki bilgi görseldeki veriyle çelişiyorsa ele.
            *   **Yoruma Dayalı:** Seçenekteki bilgi görselden doğrudan çıkarılamıyor, bir varsayım gerektiriyorsa ele. (Örn: "Satışlar düştüğü için kampanya başarısız olmuştur." yorumdur.)

        ### 3. Doğru Cevabın Kanıta Dayalı Gerekçelendirilmesi
        *   **Doğrudan İşaret Et:** Doğru cevabın görseldeki hangi veri, sayı veya ifade ile kanıtlandığını net bir şekilde göster. Örnek: "Doğru cevap A'dır, çünkü grafiğin Y eksenine ve 2020 yılına ait sütuna bakıldığında değerin 50 olduğu açıkça görülmektedir. B seçeneği ise yanlıştır çünkü 2018 yılına ait bir veri grafikte bulunmamaktadır."

        ### 4. Yapılandırılmış Yanıt
        *   Cevabını **"1. Görselin ve Sorunun Analizi"**, **"2. Seçeneklerin Görsel Verilerle Karşılaştırılması ve Elenmesi"**, **"3. Doğru Cevap ve Kanıta Dayalı Gerekçesi"** başlıkları ile yapılandır.`;
        break;

    case "sozel_mantik_muhakeme":
        specificInstruction = `
        **LGS Sözel Mantık/Muhakeme Stratejisi**

        **Amaç:** Verilen karmaşık öncülleri ve kuralları kullanarak, tüm olasılıkları değerlendirip kesin doğruya veya yanlışa ulaşmak.

        ### 1. Verilerin, Kuralların ve Değişkenlerin Kategorize Edilmesi
        *   **Listele:** Sorudaki tüm "özneleri" (kişiler, nesneler), "değişkenleri" (sıralama, yer, renk, meslek) ve "kuralları" (öncüller) listele.
        *   **Kuralları Sınıflandır:** Kuralları **kesin kurallar** ("Ali 3. sıradadır.") ve **olasılıklı/bağlantılı kurallar** ("Beren, Can'dan hemen sonradır.") olarak ayır.

        ### 2. Verileri Görselleştirmek İçin Tablo/Şema Tasarımı (EN KRİTİK ADIM)
        *   **Uygun Tabloyu Oluştur:** Değişkenlere en uygun tabloyu çiz. Genellikle en sabit olan değişken (örn: günler, sıralar) sütunlara, diğerleri satırlara yazılır. Bu, beynindeki yükü alır ve tüm olasılıkları görmeni sağlar.

        ### 3. Adım Adım Mantıksal Çıkarım Süreci
        *   **1. Kesin Bilgileri Yerleştir:** Tabloya ilk olarak kesin kuralları (pozitif veya negatif, örn: "Ali cuma günü gitmemiştir.") işaretle.
        *   **2. Bağlantılı Kuralları Kullan:** Kesin bilgilerden yola çıkarak bağlantılı kuralları uygula ve boşlukları doldur.
        *   **3. Olasılıkları Değerlendir ve Ele:** Birden fazla ihtimal olan durumlar için tabloya küçük notlar al veya farklı senaryolar (Tablo 1, Tablo 2) oluştur. Kuralları kullanarak imkansız olan olasılıkların üzerini çiz.

        ### 4. Sonuçların Analizi ve Doğru Cevabın Belirlenmesi
        *   Oluşturduğun nihai tabloya veya tablolara bakarak "hangisi kesinlikle doğrudur/yanlıştır?" veya "hangisi olabilir?" sorusunu yanıtla. Cevabını tablo üzerinden adım adım göstererek gerekçelendir.

        ### 5. Yapılandırılmış Yanıt
        *   Cevabını **"1. Verilerin ve Kuralların Analizi"**, **"2. Tablo Oluşturma ve Kesin Bilgilerin Yerleştirilmesi"**, **"3. Adım Adım Mantıksal Çıkarımlar"**, **"4. Sonuçların Analizi ve Doğru Cevap"** başlıkları ile yapılandır.`;
        break;

    case "tarih":
        specificInstruction = `
        **LGS T.C. İnkılap Tarihi ve Atatürkçülük Stratejisi**

        **Amaç:** Verilen metin, görsel veya bilgiyi, LGS müfredatındaki kesin tarihsel bilgiler ve kavramlarla birleştirerek doğru tarihsel çıkarımı yapmak.

        ### 1. Sorunun ve Verilen Materyalin Analizi
        *   **Odağı Belirle:** Soru hangi dönemi (örn: Milli Mücadele Hazırlık Dönemi), olayı (örn: Erzurum Kongresi), kavramı (örn: manda ve himaye, millî egemenlik) veya şahsiyeti hedef alıyor? Verilen metindeki anahtar ifadeleri ve vurguları tespit et.

        ### 2. LGS Müfredat Bilgisi ile Bağlantı Kurma
        *   **Akademik Bilgiyi Çağır:** Soruyu çözmek için gerekli olan 8. Sınıf müfredatındaki akademik bilgiyi hatırla. Bu, metindeki ipuçlarını doğru yorumlamanı sağlar.
        *   **Kavramsal Netlik:** Millî bağımsızlık, millî egemenlik, millî birlik ve beraberlik gibi temel kavramlar arasındaki farkları bilerek soruyu analiz et.

        ### 3. Seçeneklerin Bilgi ve Yorum Senteziyle Değerlendirilmesi
        *   **Sentez Yap:** Verilen metinden/görselden çıkarılabilecek **yorumu**, müfredattaki **kesin bilgiyle** birleştir. Örneğin, metinde "milletin azim ve kararı" ifadesi geçiyorsa, bunu müfredattaki "millî egemenlik" ilkesiyle ilişkilendir.
        *   **Eleme Yap:** Kavramsal hata içeren, anakronizm (dönem hatası) yapan, metinle çelişen veya metinden çıkarılamayacak seçenekleri ele.

        ### 4. Doğru Cevabın Kapsamlı Gerekçesi
        *   **Kanıtları Sun:** Doğru seçeneğin neden doğru olduğunu hem metindeki/görseldeki ifadeye ("Metinde geçen '...' ifadesi...") hem de ilgili müfredat bilgisine ("...bu ifade, Amasya Genelgesi'nde vurgulanan millî egemenlik ilkesine doğrudan bir göndermedir.") atıfta bulunarak adım adım açıkla.

        ### 5. Yapılandırılmış Yanıt
        *   Cevabını **"### 1. Sorunun ve Verilen Materyalin Analizi"**, **"### 2. İlgili Müfredat Bilgisi ve Kavramlar"**, **"### 3. Seçeneklerin Değerlendirilmesi"** ve **"### 4. Doğru Cevap ve Gerekçesi"** başlıkları ile yapılandır.`;
        break;

    case "din_kulturu":
        specificInstruction = `
        **LGS Din Kültürü ve Ahlak Bilgisi Stratejisi**

        **Amaç:** Verilen metin, ayet, hadis veya olayı, LGS müfredatındaki kesin dini bilgiler ve kavramlarla (kader, kaza, tevekkül, zekât vb.) doğru bir şekilde ilişkilendirerek istenen sonuca ulaşmak.

        ### 1. Sorunun ve Verilen Metnin/Ayetin Analizi
        *   **Ana Kavramı Tespit Et:** Soru ve metin hangi temel kavram veya konu üzerine odaklanmış? (Örn: Kader ve Kaza İnancı, Zekât ve Sadaka, Hz. Muhammed'in Örnekliği vb.) Metindeki anahtar ifadeleri ve mesajı belirle.

        ### 2. LGS Müfredat Bilgisi ile Bağlantı Kurma
        *   **Kavramların Doğru Tanımını Hatırla:** Kader, kaza, ecel, rızık, tevekkül, irade gibi temel kavramların LGS müfredatındaki tanımlarını ve aralarındaki ilişkiyi net bir şekilde bil.
        *   **Ayet/Hadis Yorumlama:** Verilen ayet veya hadisin hangi temel ilke veya kavramla doğrudan ilgili olduğunu müfredat bilgine dayanarak belirle.

        ### 3. Seçeneklerin Bilgi ve Mesaj Eşleştirmesiyle Değerlendirilmesi
        *   **Doğrudan Eşleştir:** Her bir seçeneği, metinden/ayetten çıkan ana mesaj ve müfredattaki doğru kavram tanımı ile karşılaştır.
        *   **Kavramsal Hataları Bul:** Kavramları yanlış yorumlayan, metnin mesajıyla çelişen veya konuyla ilgisi olmayan seçenekleri gerekçeleriyle ele. Özellikle kader ve tevekkülün yanlış anlaşılması gibi yaygın çeldiricilere dikkat et.

        ### 4. Doğru Cevabın Kapsamlı Gerekçesi
        *   **Kanıtları Sun:** Doğru seçeneğin, metindeki/ayetteki mesajla nasıl bire bir örtüştüğünü açıkla. ("Ayette geçen '... çalışmasının karşılığı vardır' ifadesi, İslam'daki emek ve irade kavramına vurgu yapmaktadır. Bu nedenle doğru cevap 'C' seçeneğidir.") Diğer seçeneklerin neden kavramsal olarak hatalı veya metinle uyumsuz olduğunu belirt.

        ### 5. Yapılandırılmış Yanıt
        *   Cevabını **"### 1. Sorunun ve Metnin/Ayetin Analizi"**, **"### 2. İlgili Dini Kavram ve Müfredat Bilgisi"**, **"### 3. Seçeneklerin Değerlendirilmesi"** ve **"### 4. Doğru Cevap ve Gerekçesi"** başlıkları ile yapılandır.`;
        break;

    case "yabanci_dil_ingilizce":
        specificInstruction = `
        **LGS English Question Solving Strategy**

        **Objective:** To accurately understand the given text, dialogue, or visual, and to choose the correct option based solely on the evidence provided.

        ### 1. Analyze the Text/Question/Visual
        *   **Identify the Main Idea and Purpose:** Carefully read the text, dialogue, or visual. Understand the main topic (e.g., friendship, internet, adventure), the speaker's purpose (e.g., inviting, apologizing, giving information), and key vocabulary/phrases.
        *   **Understand the Question:** Read the question very carefully to understand exactly what is being asked (e.g., "Which one is CORRECT?", "Who refuses the invitation and gives a reason?", "What is the text mainly about?").

        ### 2. Locate Specific Evidence in the Text
        *   **Scan for Keywords:** Scan the text for keywords from the question and the options.
        *   **Find the Exact Source:** Pinpoint the exact sentence or part of the dialogue that provides the answer. Do not rely on your general memory of the text.

        ### 3. Systematically Evaluate and Eliminate Options
        *   **Compare Each Option with the Evidence:** Take each option one by one and check if it is supported by the evidence you found in the text.
        *   **Eliminate with Reasons:** Clearly identify why an option is wrong:
            *   **Contradictory:** The text says the opposite.
            *   **Not Mentioned:** This information is not in the text at all.
            *   **Irrelevant:** The information might be true but does not answer the specific question asked.

        ### 4. Justify the Correct Answer with Evidence
        *   **State Why It's Correct:** Explain why the chosen option is the correct answer by directly referencing the evidence from the text. You can quote the relevant part if necessary.
        *   **State Why Others Are Incorrect:** Briefly explain your reasons for eliminating the other options, linking them back to the text (or lack of information in the text).

        ### 5. Structured Response
        *   Structure your answer using the headings: **"### 1. Analysis of the Text and Question"**, **"### 2. Locating Evidence from the Text"**, **"### 3. Option Evaluation and Elimination"**, and **"### 4. Justification for the Correct Answer"**.`;
        break;

    case "genel_bilgi":
    default:
        specificInstruction = `
        **LGS Genel Soru Çözüm ve Konu Anlatımı Stratejisi**

        **Amaç:** Sorulan soruya veya istenen kavrama, LGS müfredatına uygun, doğru, kapsamlı ve anlaşılır bir cevap vermek.

        ### 1. Sorunun Odağını Kesin Olarak Anla
        *   Sorunun hangi konu, kavram veya bilgi alanıyla ilgili olduğunu net bir şekilde belirle.
        *   Kullanıcının beklentisini anla: Sadece bir tanım mı, bir karşılaştırma mı, yoksa adım adım bir çözüm mü isteniyor?

        ### 2. Bilgiyi Güvenilir Kaynaklara Dayandır
        *   Sunulacak tüm bilgilerin LGS müfredatı, MEB kaynakları ve TDK gibi güvenilir referanslara dayandığından emin ol.
        *   Yoruma dayalı veya kesin olmayan bilgilerden kaçın. Net ve doğrulanabilir bilgiler sun.

        ### 3. Açık, Adım Adım ve Kapsamlı Açıklama Sun
        *   Karmaşık konuları daha basit parçalara ayırarak anlat.
        *   Gerekli yerlerde somut örnekler, analojiler veya listeler kullanarak konunun daha iyi anlaşılmasını sağla.
        *   Adım adım çözüm gerektiren sorularda her adımı mantıksal bir sırayla ve açık bir şekilde gerekçelendir.

        ### 4. Yapılandırılmış ve Anlaşılır Yanıt Oluştur
        *   Cevabını başlıklar, alt başlıklar, madde işaretleri veya numaralı listeler kullanarak organize et.
        *   Önemli kavramları veya anahtar kelimeleri **kalın** yazarak vurgula. Bu, bilginin okunmasını ve akılda kalmasını kolaylaştırır.`;
        break;

            }
            finalSystemInstruction = `${baseSystemInstruction}\n\n${specificInstruction}`;
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
// NOT: Yukarıdaki switch bloğunun içini bir önceki yanıttaki detaylı stratejilerle doldurun.
// Bu yanıtın uzunluğunu kontrol altında tutmak için tekrar eklenmedi.
