/**
 * Email Templates Test Script
 * Run: npx ts-node src/scripts/test_emails.ts
 * 
 * This script tests all email templates by sending them to a specified email address.
 */

import dotenv from 'dotenv';
dotenv.config();

import { emailService } from '../services/email.service';

const TEST_EMAIL = 'vtduong04@gmail.com';
const TEST_USER_NAME = 'Dương';

async function testAllEmails() {
    console.log('🚀 Starting Email Template Tests...\n');
    console.log(`📧 Sending to: ${TEST_EMAIL}\n`);

    const results: { name: string; success: boolean; error?: string }[] = [];

    // 1. Test Password Reset OTP (Vietnamese)
    console.log('1️⃣ Testing Password Reset OTP (Vietnamese)...');
    try {
        await emailService.sendPasswordResetOtp({
            to: TEST_EMAIL,
            otp: '123456',
            userName: TEST_USER_NAME,
            language: 'vi',
        });
        results.push({ name: 'Password Reset OTP (VI)', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Password Reset OTP (VI)', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 2. Test Email Verification OTP (English)
    console.log('2️⃣ Testing Email Verification OTP (English)...');
    try {
        await emailService.sendVerificationOtp({
            to: TEST_EMAIL,
            otp: '789012',
            userName: TEST_USER_NAME,
            language: 'en',
        });
        results.push({ name: 'Verification OTP (EN)', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Verification OTP (EN)', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 3. Test QR Scan Alert
    console.log('3️⃣ Testing QR Scan Alert...');
    try {
        await emailService.sendQrScanAlert({
            to: TEST_EMAIL,
            ownerName: TEST_USER_NAME,
            dogName: 'Lucky',
            locationInfo: 'Quận 1, TP.HCM, Việt Nam (10.776, 106.699)',
            scanTime: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'full', timeStyle: 'medium' }),
            language: 'vi',
        });
        results.push({ name: 'QR Scan Alert', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'QR Scan Alert', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 4. Test Dog Found Notification
    console.log('4️⃣ Testing Dog Found Notification...');
    try {
        await emailService.sendDogFoundNotification({
            to: TEST_EMAIL,
            ownerName: TEST_USER_NAME,
            dogId: 'test-dog-id-123',
            finderName: 'Nguyễn Văn A',
            finderPhone: '0901234567',
            finderEmail: 'finder@example.com',
            message: 'Tôi tìm thấy bé đang lang thang ở công viên Lê Văn Tám.',
            location: { lat: 10.776, lng: 106.699, address: 'Công viên Lê Văn Tám, Quận 1' },
            verificationType: 'qr',
            language: 'vi',
        });
        results.push({ name: 'Dog Found Notification', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Dog Found Notification', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 5. Test Thank Finder Email (with account)
    console.log('5️⃣ Testing Thank Finder Email (with account)...');
    try {
        await emailService.sendThankFinderEmail({
            to: TEST_EMAIL,
            finderName: 'Nguyễn Văn A',
            dogName: 'Lucky',
            dogBreed: 'Golden Retriever',
            location: 'Công viên Lê Văn Tám, Quận 1',
            verificationType: 'qr',
            hasAccount: true,
            language: 'vi',
        });
        results.push({ name: 'Thank Finder (with account)', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Thank Finder (with account)', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 6. Test Thank Finder Email (without account - English)
    console.log('6️⃣ Testing Thank Finder Email (no account, English)...');
    try {
        await emailService.sendThankFinderEmail({
            to: TEST_EMAIL,
            finderName: 'John Doe',
            dogName: 'Buddy',
            dogBreed: 'Labrador',
            location: 'Central Park, NYC',
            verificationType: 'camera',
            hasAccount: false,
            language: 'en',
        });
        results.push({ name: 'Thank Finder (EN, no account)', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Thank Finder (EN, no account)', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 7. Test Health Reminder (Today)
    console.log('7️⃣ Testing Health Reminder (Today)...');
    try {
        await emailService.sendHealthReminder({
            to: TEST_EMAIL,
            ownerName: TEST_USER_NAME,
            dogName: 'Lucky',
            recordTitle: 'Tiêm phòng dại',
            recordType: 'vaccine',
            formattedDate: new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            isToday: true,
            language: 'vi',
        });
        results.push({ name: 'Health Reminder (Today)', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Health Reminder (Today)', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 8. Test Health Reminder (Tomorrow - English)
    console.log('8️⃣ Testing Health Reminder (Tomorrow, English)...');
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await emailService.sendHealthReminder({
            to: TEST_EMAIL,
            ownerName: TEST_USER_NAME,
            dogName: 'Buddy',
            recordTitle: 'Regular Checkup',
            recordType: 'checkup',
            formattedDate: tomorrow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
            isToday: false,
            language: 'en',
        });
        results.push({ name: 'Health Reminder (EN, Tomorrow)', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Health Reminder (EN, Tomorrow)', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // 9. Test Feedback Thank You (sent on submit now)
    console.log('9️⃣ Testing Feedback Thank You Email...');
    try {
        await emailService.sendFeedbackThankYouEmail({
            to: TEST_EMAIL,
            userName: TEST_USER_NAME,
            breedLabel: 'Siberian Husky',
            language: 'vi',
        });
        results.push({ name: 'Feedback Thank You', success: true });
        console.log('   ✅ Success!\n');
    } catch (error: any) {
        results.push({ name: 'Feedback Thank You', success: false, error: error.message });
        console.log(`   ❌ Failed: ${error.message}\n`);
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════');
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    results.forEach((r, i) => {
        console.log(`   ${i + 1}. ${r.name}: ${r.success ? '✅ PASSED' : `❌ FAILED - ${r.error}`}`);
    });

    console.log('\n───────────────────────────────────────────────────────');
    console.log(`   Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
    console.log('───────────────────────────────────────────────────────\n');

    if (failed === 0) {
        console.log('🎉 All email templates are working correctly!');
    } else {
        console.log('⚠️  Some tests failed. Please check the errors above.');
    }

    console.log(`\n📬 Check your inbox at: ${TEST_EMAIL}`);
}

// Run the tests
testAllEmails().catch(console.error);
