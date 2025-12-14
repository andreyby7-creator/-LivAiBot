apps/mobile/ # 🔹 Тонкий UI слой для мобильного приложения (React Native 0.82+ + Expo 54+ +
TypeScript + FP + Effect)

├── app.json # 🔹 Expo конфигурация (PWA, icons, splash, permissions) (JSON) ├── metro.config.js #
🔹 Metro bundler конфигурация (JavaScript) ├── index.js # 🔹 Entry point для Expo (JavaScript) ├──
App.tsx # 🔹 Root component приложения (TypeScript + React Native + FP)

└── src/ ├── navigation/ # 🔹 React Navigation routing (mobile-first) │ ├── types.ts # 🔹 Navigation
type definitions (TypeScript) │ ├── AppNavigator.tsx # 🔹 Main navigator with auth guards
(TypeScript + React Native + FP) │ ├── AuthNavigator.tsx # 🔹 Auth stack (login/register/biometric)
(TypeScript + React Native + FP) │ ├── MainTabNavigator.tsx # 🔹 Bottom tab navigation (TypeScript +
React Native + FP) │ ├── ProfileStackNavigator.tsx # 🔹 Profile stack navigation (TypeScript + React
Native + FP) │ ├── SubscriptionStackNavigator.tsx # 🔹 Subscription stack navigation (TypeScript +
React Native + FP) │ ├── BillingStackNavigator.tsx # 🔹 Billing stack navigation (TypeScript + React
Native + FP) │ ├── BotStackNavigator.tsx # 🔹 AI Bot stack navigation (TypeScript + React Native +
FP) │ ├── ChatModalNavigator.tsx # 🔹 Chat modal navigation (TypeScript + React Native + FP │ ├──
navigationTheme.ts # 🔹 Custom navigation theme (TypeScript + React Native + FP) │ └──
deepLinks.ts # 🔹 Deep linking configuration (TypeScript + FP) │ ├── screens/ # 🔹 Mobile screens
(flat structure, not nested routes) │ ├── auth/ # 🔹 Authentication screens │ │ ├──
LoginScreen.tsx # 🔹 Login screen with biometrics (TypeScript + React Native + FP) │ │ ├──
RegisterScreen.tsx # 🔹 Register screen (TypeScript + React Native + FP) │ │ └──
BiometricSetupScreen.tsx # 🔹 Biometric setup (TypeScript + React Native + FP) │ ├── onboarding/ #
🔹 Onboarding screens │ │ ├── WelcomeScreen.tsx # 🔹 Welcome screen (TypeScript + React Native + FP)
│ │ ├── PermissionsScreen.tsx # 🔹 Permissions request (TypeScript + React Native + FP) │ │ └──
TutorialScreen.tsx # 🔹 App tutorial (TypeScript + React Native + FP) │ ├── home/ # 🔹
Home/Dashboard screens │ │ ├── HomeScreen.tsx # 🔹 Main home screen (TypeScript + React Native + FP)
│ │ └── DashboardScreen.tsx # 🔹 User dashboard (TypeScript + React Native + FP) │ ├── profile/ # 🔹
Profile screens │ │ ├── ProfileScreen.tsx # 🔹 Profile view (TypeScript + React Native + FP) │ │ ├──
EditProfileScreen.tsx # 🔹 Edit profile (TypeScript + React Native + FP) │ │ └──
SettingsScreen.tsx # 🔹 App settings (TypeScript + React Native + FP) │ ├── subscriptions/ # 🔹
Subscription screens │ │ ├── SubscriptionsScreen.tsx # 🔹 Subscriptions list (TypeScript + React
Native + FP) │ │ ├── SubscriptionDetailScreen.tsx # 🔹 Subscription details (TypeScript + React
Native + FP) │ │ └── UpgradeScreen.tsx # 🔹 Subscription upgrade (TypeScript + React Native + FP) │
├── billing/ # 🔹 Billing screens │ │ ├── BillingScreen.tsx # 🔹 Billing history (TypeScript + React
Native + FP) │ │ ├── PaymentScreen.tsx # 🔹 Payment screen (TypeScript + React Native + FP) │ │ └──
InvoiceScreen.tsx # 🔹 Invoice viewer (TypeScript + React Native + FP) │ ├── bots/ # 🔹 AI Bot
screens │ │ ├── BotsScreen.tsx # 🔹 Bots list (TypeScript + React Native + FP) │ │ ├──
BotDetailScreen.tsx # 🔹 Bot details (TypeScript + React Native + FP) │ │ ├── CreateBotScreen.tsx #
🔹 Create bot (TypeScript + React Native + FP) │ │ └── BotSettingsScreen.tsx # 🔹 Bot settings
(TypeScript + React Native + FP) │ ├── chat/ # 🔹 AI Chat screens │ │ ├── ChatListScreen.tsx # 🔹
Chat conversations list (TypeScript + React Native + FP) │ │ ├── ChatScreen.tsx # 🔹 Chat interface
(TypeScript + React Native + FP + WebSocket) │ │ └── ChatSettingsScreen.tsx # 🔹 Chat settings
(TypeScript + React Native + FP) │ └── common/ # 🔹 Common screens │ ├── WebViewScreen.tsx # 🔹
WebView for external content (TypeScript + React Native + FP) │ ├── ImageViewerScreen.tsx # 🔹 Image
viewer (TypeScript + React Native + FP) │ └── ErrorScreen.tsx # 🔹 Error/fallback screen
(TypeScript + React Native + FP) │ ├── components/ # 🔹 Mobile-specific UI components │ ├── core/ #
🔹 Core mobile components │ │ ├── Button.tsx # 🔹 Custom button with haptic feedback (TypeScript +
React Native + FP) │ │ ├── TextInput.tsx # 🔹 Custom text input (TypeScript + React Native + FP) │ │
├── Card.tsx # 🔹 Card component (TypeScript + React Native + FP) │ │ └── LoadingSpinner.tsx # 🔹
Loading indicator (TypeScript + React Native + FP) │ │ │ ├── layout/ # 🔹 Layout components │ │ ├──
SafeAreaView.tsx # 🔹 Safe area wrapper (TypeScript + React Native + FP) │ │ ├──
KeyboardAvoidingView.tsx # 🔹 Keyboard avoiding wrapper (TypeScript + React Native + FP) │ │ ├──
Header.tsx # 🔹 Screen header with back button (TypeScript + React Native + FP) │ │ ├── TabBar.tsx #
🔹 Custom tab bar (TypeScript + React Native + FP) │ │ └── StatusBar.tsx # 🔹 Status bar
customization (TypeScript + React Native + FP) │ │ │ ├── chat/ # 🔹 Chat-specific components │ │ ├──
MessageBubble.tsx # 🔹 Message bubble with swipe actions (TypeScript + React Native + FP) │ │ ├──
ChatInput.tsx # 🔹 Chat input with voice/camera (TypeScript + React Native + FP) │ │ ├──
TypingIndicator.tsx # 🔹 Typing indicator (TypeScript + React Native + FP) │ │ ├── MessageList.tsx #
🔹 Virtualized message list (TypeScript + React Native + FP) │ │ └── AttachmentPicker.tsx # 🔹
File/camera picker (TypeScript + React Native + FP) │ │ │ ├── forms/ # 🔹 Mobile forms │ │ ├──
FormField.tsx # 🔹 Form field wrapper (TypeScript + React Native + FP) │ │ ├── PickerField.tsx # 🔹
Picker/dropdown field (TypeScript + React Native + FP) │ │ ├── DatePickerField.tsx # 🔹 Date picker
field (TypeScript + React Native + FP) │ │ └── ImagePickerField.tsx # 🔹 Image picker field
(TypeScript + React Native + FP) │ │ │ ├── modals/ # 🔹 Mobile modals (bottom sheets preferred) │ │
├── BottomSheetModal.tsx # 🔹 Base bottom sheet (TypeScript + React Native + FP) │ │ ├──
ActionSheetModal.tsx # 🔹 Action sheet (TypeScript + React Native + FP) │ │ ├──
ImagePickerModal.tsx # 🔹 Image picker modal (TypeScript + React Native + FP) │ │ └──
SubscriptionModal.tsx # 🔹 Subscription options (TypeScript + React Native + FP) │ │ │ ├── native/ #
🔹 Platform-specific components │ │ ├── BiometricPrompt.tsx # 🔹 Biometric auth prompt (TypeScript +
React Native + FP) │ │ ├── PushNotificationBanner.tsx # 🔹 Push notification banner (TypeScript +
React Native + FP) │ │ ├── OfflineIndicator.tsx # 🔹 Offline status indicator (TypeScript + React
Native + FP) │ │ └── PermissionPrompt.tsx # 🔹 Permission request prompt (TypeScript + React
Native + FP) │ │ │ └── animations/ # 🔹 Mobile animations │ ├── FadeInView.tsx # 🔹 Fade in
animation (TypeScript + React Native + FP) │ ├── SlideInView.tsx # 🔹 Slide in animation
(TypeScript + React Native + FP) │ ├── SkeletonLoader.tsx # 🔹 Skeleton loading animation
(TypeScript + React Native + FP) │ └── HapticButton.tsx # 🔹 Button with haptic feedback
(TypeScript + React Native + FP) │ ├── features/ # 🔹 Feature-based mobile modules │ ├── auth/ # 🔹
Authentication feature │ │ ├── api/ # 🔹 Auth API calls │ │ │ ├── queries.ts # 🔹 Auth status
queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Login/logout mutations (TypeScript +
FP + Effect) │ │ ├── hooks/ # 🔹 Auth hooks │ │ │ ├── useAuth.ts # 🔹 Main auth hook (TypeScript +
React Native + FP + Effect) │ │ │ ├── useBiometricAuth.ts # 🔹 Biometric auth hook (TypeScript +
React Native + FP + Effect) │ │ │ └── useAuthState.ts # 🔹 Auth state management (TypeScript + React
Native + FP + Effect) │ │ ├── services/ # 🔹 Auth services │ │ │ ├── BiometricService.ts # 🔹
Biometric auth service (TypeScript + FP + Effect) │ │ │ └── KeychainService.ts # 🔹 Secure storage
service (TypeScript + FP + Effect) │ │ └── components/ # 🔹 Auth components │ │ ├── LoginForm.tsx #
🔹 Login form (TypeScript + React Native + FP) │ │ └── BiometricButton.tsx # 🔹 Biometric auth
button (TypeScript + React Native + FP) │ │ │ ├── chat/ # 🔹 AI Chat feature (CORE FEATURE) │ │ ├──
api/ # 🔹 Chat API (WebSocket + HTTP) │ │ │ ├── queries.ts # 🔹 Chat history queries (TypeScript +
FP + Effect) │ │ │ └── mutations.ts # 🔹 Send message mutations (TypeScript + FP + Effect) │ │ ├──
hooks/ # 🔹 Chat hooks │ │ │ ├── useChat.ts # 🔹 Main chat hook (TypeScript + React Native + FP +
Effect + WebSocket) │ │ │ ├── useChatMessages.ts # 🔹 Messages management (TypeScript + React
Native + FP + Effect) │ │ │ ├── useChatVoice.ts # 🔹 Voice recording hook (TypeScript + React
Native + FP + Effect) │ │ │ └── useChatOffline.ts # 🔹 Offline chat queue (TypeScript + React
Native + FP + Effect) │ │ ├── services/ # 🔹 Chat services │ │ │ ├── WebSocketService.ts # 🔹
WebSocket connection (TypeScript + FP + Effect) │ │ │ ├── VoiceService.ts # 🔹 Voice
recording/playback (TypeScript + FP + Effect) │ │ │ └── OfflineQueueService.ts # 🔹 Offline message
queue (TypeScript + FP + Effect) │ │ └── components/ # 🔹 Chat components │ │ ├──
VoiceMessagePlayer.tsx # 🔹 Voice message player (TypeScript + React Native + FP) │ │ └──
OfflineIndicator.tsx # 🔹 Chat offline indicator (TypeScript + React Native + FP) │ │ │ ├──
notifications/ # 🔹 Push notifications feature │ │ ├── api/ # 🔹 Notification API │ │ │ ├──
queries.ts # 🔹 Notification queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹
Notification mutations (TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Notification hooks │ │ │ ├──
usePushNotifications.ts # 🔹 Push notification hook (TypeScript + React Native + FP + Effect) │ │ │
├── useNotificationPermissions.ts # 🔹 Notification permissions (TypeScript + React Native + FP +
Effect) │ │ │ └── useNotificationSettings.ts # 🔹 Notification settings (TypeScript + React Native +
FP + Effect) │ │ ├── services/ # 🔹 Notification services │ │ │ ├── FCMService.ts # 🔹 Firebase
Cloud Messaging (TypeScript + FP + Effect) │ │ │ └── LocalNotificationService.ts # 🔹 Local
notifications (TypeScript + FP + Effect) │ │ └── components/ # 🔹 Notification components │ │ ├──
NotificationItem.tsx # 🔹 Notification list item (TypeScript + React Native + FP) │ │ └──
NotificationSettings.tsx # 🔹 Notification settings UI (TypeScript + React Native + FP) │ │ │ ├──
camera/ # 🔹 Camera integration feature │ │ ├── hooks/ # 🔹 Camera hooks │ │ │ ├── useCamera.ts # 🔹
Camera hook (TypeScript + React Native + FP + Effect) │ │ │ └── useImagePicker.ts # 🔹 Image picker
hook (TypeScript + React Native + FP + Effect) │ │ ├── services/ # 🔹 Camera services │ │ │ ├──
CameraService.ts # 🔹 Camera service (TypeScript + FP + Effect) │ │ │ └──
ImageProcessingService.ts # 🔹 Image processing (TypeScript + FP + Effect) │ │ └── components/ # 🔹
Camera components │ │ ├── CameraView.tsx # 🔹 Camera preview (TypeScript + React Native + FP) │ │
└── ImagePreview.tsx # 🔹 Image preview/crop (TypeScript + React Native + FP) │ │ │ ├── offline/ #
🔹 Offline capabilities feature │ │ ├── hooks/ # 🔹 Offline hooks │ │ │ ├── useNetworkStatus.ts # 🔹
Network connectivity hook (TypeScript + React Native + FP + Effect) │ │ │ └── useOfflineQueue.ts #
🔹 Offline action queue (TypeScript + React Native + FP + Effect) │ │ ├── services/ # 🔹 Offline
services │ │ │ ├── OfflineStorageService.ts # 🔹 Offline data storage (TypeScript + FP + Effect) │ │
│ └── SyncService.ts # 🔹 Data synchronization (TypeScript + FP + Effect) │ │ └── components/ # 🔹
Offline components │ │ ├── OfflineBanner.tsx # 🔹 Offline status banner (TypeScript + React Native +
FP) │ │ └── SyncIndicator.tsx # 🔹 Sync progress indicator (TypeScript + React Native + FP) │ │ │
├── profile/ # 🔹 User profile feature │ │ ├── api/ # 🔹 Profile API │ │ │ ├── queries.ts # 🔹
Profile queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Profile mutations
(TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Profile hooks │ │ │ ├── useProfile.ts # 🔹 Profile
hook (TypeScript + React Native + FP + Effect) │ │ │ └── useProfileForm.ts # 🔹 Profile form hook
(TypeScript + React Native + FP + Effect) │ │ └── components/ # 🔹 Profile components │ │ ├──
ProfileAvatar.tsx # 🔹 Profile avatar picker (TypeScript + React Native + FP) │ │ └──
ProfileStats.tsx # 🔹 Profile statistics (TypeScript + React Native + FP) │ │ │ ├── subscriptions/ #
🔹 Subscription management │ │ ├── api/ # 🔹 Subscription API │ │ │ ├── queries.ts # 🔹 Subscription
queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Subscription mutations (TypeScript +
FP + Effect) │ │ ├── hooks/ # 🔹 Subscription hooks │ │ │ ├── useSubscriptions.ts # 🔹 Subscriptions
hook (TypeScript + React Native + FP + Effect) │ │ │ ├── useInAppPurchase.ts # 🔹 In-app purchase
hook (TypeScript + React Native + FP + Effect) │ │ │ └── useSubscriptionStatus.ts # 🔹 Subscription
status hook (TypeScript + React Native + FP + Effect) │ │ ├── services/ # 🔹 Subscription services │
│ │ ├── IAPService.ts # 🔹 In-app purchase service (TypeScript + FP + Effect) │ │ │ └──
SubscriptionService.ts # 🔹 Subscription management (TypeScript + FP + Effect) │ │ └── components/ #
🔹 Subscription components │ │ ├── SubscriptionCard.tsx # 🔹 Subscription card (TypeScript + React
Native + FP) │ │ └── IAPProductList.tsx # 🔹 In-app purchase products (TypeScript + React Native +
FP) │ │ │ ├── billing/ # 🔹 Billing feature │ │ ├── api/ # 🔹 Billing API │ │ │ ├── queries.ts # 🔹
Billing queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Billing mutations
(TypeScript + FP + Effect) │ │ ├── hooks/ # 🔹 Billing hooks │ │ │ ├── usePayments.ts # 🔹 Payments
hook (TypeScript + React Native + FP + Effect) │ │ │ └── useBillingHistory.ts # 🔹 Billing history
hook (TypeScript + React Native + FP + Effect) │ │ └── components/ # 🔹 Billing components │ │ ├──
PaymentMethodCard.tsx # 🔹 Payment method card (TypeScript + React Native + FP) │ │ └──
ReceiptViewer.tsx # 🔹 Receipt viewer (TypeScript + React Native + FP) │ │ │ └──
ai-bot-management/ # 🔹 AI Bot management │ ├── api/ # 🔹 Bot API │ │ ├── queries.ts # 🔹 Bot
queries (TypeScript + FP + Effect) │ │ │ └── mutations.ts # 🔹 Bot mutations (TypeScript + FP +
Effect) │ ├── hooks/ # 🔹 Bot hooks │ │ ├── useBots.ts # 🔹 Bots hook (TypeScript + React Native +
FP + Effect) │ │ ├── useBotCreation.ts # 🔹 Bot creation hook (TypeScript + React Native + FP +
Effect) │ │ └── useBotAnalytics.ts # 🔹 Bot analytics hook (TypeScript + React Native + FP + Effect)
│ ├── services/ # 🔹 Bot services │ │ ├── BotTrainingService.ts # 🔹 Bot training service
(TypeScript + FP + Effect) │ │ └── BotAnalyticsService.ts # 🔹 Bot analytics service (TypeScript +
FP + Effect) │ └── components/ # 🔹 Bot components │ ├── BotCard.tsx # 🔹 Bot card (TypeScript +
React Native + FP) │ ├── TrainingProgress.tsx # 🔹 Training progress indicator (TypeScript + React
Native + FP) │ └── BotAnalyticsChart.tsx # 🔹 Bot analytics chart (TypeScript + React Native + FP) →
shared/ui/organisms/charts/ │ ├── services/ # 🔹 Mobile-specific services │ ├── native/ # 🔹 Native
platform services │ │ ├── BiometricService.ts # 🔹 Biometric authentication (TypeScript + FP +
Effect) │ │ ├── NotificationService.ts # 🔹 Push notifications (TypeScript + FP + Effect) │ │ ├──
CameraService.ts # 🔹 Camera access (TypeScript + FP + Effect) │ │ ├── LocationService.ts # 🔹
GPS/location (TypeScript + FP + Effect) │ │ └── HapticService.ts # 🔹 Haptic feedback (TypeScript +
FP + Effect) │ ├── storage/ # 🔹 Local storage services │ │ ├── AsyncStorageService.ts # 🔹
AsyncStorage wrapper (TypeScript + FP + Effect) │ │ ├── SecureStorageService.ts # 🔹 Secure keychain
storage (TypeScript + FP + Effect) │ │ └── FileSystemService.ts # 🔹 File system access
(TypeScript + FP + Effect) │ ├── network/ # 🔹 Network services │ │ ├── NetworkMonitorService.ts #
🔹 Network connectivity monitoring (TypeScript + FP + Effect) │ │ ├── BackgroundSyncService.ts # 🔹
Background data sync (TypeScript + FP + Effect) │ │ └── RetryService.ts # 🔹 Network retry logic
(TypeScript + FP + Effect) │ └── analytics/ # 🔹 Mobile analytics │ └── MobileAnalyticsService.ts #
🔹 Mobile-specific analytics (TypeScript + FP + Effect) │ ├── hooks/ # 🔹 Re-exports из
apps/shared-ui/hooks + mobile-specific │ ├── index.ts # 🔹 Shared hooks + mobile-specific hooks
(TypeScript + React Native + FP + Effect) │ ├── useFormProvider.ts # 🔹 Единый FormProvider для
mobile (TypeScript + React Native + FP + Effect) │ ├── useDeviceInfo.ts # 🔹 Device information hook
(TypeScript + React Native + FP + Effect) │ ├── useAppState.ts # 🔹 App state
(foreground/background) hook (TypeScript + React Native + FP + Effect) │ └── usePermissions.ts # 🔹
Permissions management hook (TypeScript + React Native + FP + Effect) │ ├── context/ # 🔹 Re-exports
из apps/shared-ui/context + mobile-specific │ ├── index.ts # 🔹 Shared contexts + mobile contexts
(TypeScript + React Native + FP + Effect) │ ├── NetworkContext.tsx # 🔹 Network connectivity context
(TypeScript + React Native + FP + Effect) │ └── DeviceContext.tsx # 🔹 Device information context
(TypeScript + React Native + FP + Effect) │ ├── constants/ # 🔹 Mobile-specific constants │ ├──
colors.ts # 🔹 App color palette (TypeScript) │ ├── dimensions.ts # 🔹 Screen dimensions and
breakpoints (TypeScript) │ ├── animations.ts # 🔹 Animation constants (TypeScript) │ └──
permissions.ts # 🔹 Permission constants (TypeScript) │ ├── utils/ # 🔹 Mobile-specific utilities │
├── platform/ # 🔹 Platform detection │ │ ├── isIOS.ts # 🔹 iOS detection (TypeScript + FP) │ │ ├──
isAndroid.ts # 🔹 Android detection (TypeScript + FP) │ │ └── getPlatformVersion.ts # 🔹 Platform
version utilities (TypeScript + FP) │ ├── formatting/ # 🔹 Mobile formatting │ │ ├── currency.ts #
🔹 Mobile currency formatting (TypeScript + FP) │ │ ├── dateTime.ts # 🔹 Mobile date/time formatting
(TypeScript + FP) │ │ └── fileSize.ts # 🔹 File size formatting (TypeScript + FP) │ ├──
validation/ # 🔹 Mobile validation │ │ └── mobileValidators.ts # 🔹 Mobile-specific validators
(TypeScript + FP + Zod) │ ├── permissions/ # 🔹 Permission utilities │ │ ├── requestPermissions.ts #
🔹 Permission request utilities (TypeScript + FP) │ │ └── checkPermissions.ts # 🔹 Permission check
utilities (TypeScript + FP) │ └── haptics/ # 🔹 Haptic feedback utilities │ ├── lightHaptic.ts # 🔹
Light haptic feedback (TypeScript + FP) │ ├── mediumHaptic.ts # 🔹 Medium haptic feedback
(TypeScript + FP) │ └── heavyHaptic.ts # 🔹 Heavy haptic feedback (TypeScript + FP) │ └── types/ #
🔹 Mobile-specific TypeScript types ├── navigation.ts # 🔹 Navigation types (TypeScript) ├──
permissions.ts # 🔹 Permission types (TypeScript) ├── notifications.ts # 🔹 Notification types
(TypeScript) ├── camera.ts # 🔹 Camera types (TypeScript) └── platform.ts # 🔹 Platform-specific
types (TypeScript)
