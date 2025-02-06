// supabase-init.js
import { createClient } from '@supabase/supabase-js'

// تكوين Supabase - قم بتغيير هذه القيم بقيم مشروعك على Supabase
const supabaseUrl = 'https://tdtuozwimcyvqsaplccr.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdHVvendpbWN5dnFzYXBsY2NyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUwOTEwMjIsImV4cCI6MjA1MDY2NzAyMn0.YXUFrlJi-XsA5Z_d0Rx6c97VdazhK4LqtMv2PJpc1nU'

// إنشاء عميل Supabase
const supabase = createClient(supabaseUrl, supabaseKey)

// دالة للتحقق من حالة الاتصال
export const checkConnection = async () => {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('count')
            .single()
        
        if (error) throw error
        console.log('Connected to Supabase successfully')
        return true
    } catch (error) {
        console.error('Supabase connection error:', error.message)
        return false
    }
}

// تصدير عميل Supabase للاستخدام في بقية التطبيق
export default supabase

// المراقبة في الوقت الفعلي للسائقين
export const setupRealtimeDrivers = (callback) => {
    const subscription = supabase
        .channel('public:drivers')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'drivers' },
            (payload) => callback(payload)
        )
        .subscribe()

    return subscription
}

// إعداد المراقبة في الوقت الفعلي للمحادثات
export const setupRealtimeChat = (userId, driverId, callback) => {
    const subscription = supabase
        .channel('public:messages')
        .on('postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'messages',
                filter: `user_id=eq.${userId},driver_id=eq.${driverId}`
            },
            (payload) => callback(payload)
        )
        .subscribe()

    return subscription
}