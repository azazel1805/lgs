// Bu fonksiyon, giriş yapmış kullanıcının yeni bir sorusunu geçmişe kaydeder.
exports.handler = async function(event, context) {
    const { user } = context.clientContext;

    if (!user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: "Bu işlemi yapmak için giriş yapmalısınız." })
        };
    }

    const { getStore } = await import("@netlify/blobs");
    const store = getStore("lgs-ai-history");
    const userId = user.sub; // Kullanıcının benzersiz ID'si
    
    const newEntry = JSON.parse(event.body);
    
    // Mevcut geçmişi al
    let userHistory = await store.get(userId, { type: "json" }) || [];
    
    // Eğer bu soru zaten varsa (örneğin sadece review durumu güncelleniyorsa), onu bul ve güncelle.
    const existingEntryIndex = userHistory.findIndex(item => item.timestamp === newEntry.timestamp);
    
    if (existingEntryIndex > -1) {
        // Sadece review durumunu güncelle (eğer true ise)
        if (newEntry.review) {
            userHistory[existingEntryIndex].review = true;
        }
    } else {
        // Yeni soru ise, geçmişe ekle
        userHistory.push(newEntry);
    }
    
    // Güncellenmiş geçmişi Netlify Blobs'a kaydet
    await store.setJSON(userId, userHistory);

    return {
        statusCode: 200,
        body: JSON.stringify({ message: "Geçmiş başarıyla güncellendi." })
    };
};
