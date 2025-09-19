// Bu fonksiyon, giriş yapmış kullanıcının tüm soru geçmişini getirir.
exports.handler = async function(event, context) {
    const { user } = context.clientContext;

    if (!user) {
        return {
            statusCode: 401,
            body: JSON.stringify({ message: "Bu işlemi yapmak için giriş yapmalısınız." })
        };
    }
    
    // Netlify Blobs'dan veriyi getir
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("lgs-ai-history");
    const historyData = await store.get(user.sub, { type: "json" });

    return {
        statusCode: 200,
        body: JSON.stringify({ history: historyData || [] }) // Eğer veri yoksa boş bir dizi döndür
    };
};
