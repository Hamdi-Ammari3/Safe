import { useState } from 'react'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,Linking,Modal,Dimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import colors from '../../../../constants/Colors'
import { useAuth,useUser } from '@clerk/clerk-expo'
import { deleteDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { DB } from '../../../../firebaseConfig'
import { useDriverData } from '../../../stateManagment/DriverContext'
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import Ionicons from '@expo/vector-icons/Ionicons'
import AntDesign from '@expo/vector-icons/AntDesign'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import Fontisto from '@expo/vector-icons/Fontisto'

const profile = () => {
  const {userData,fetchingUserDataLoading} = useDriverData()

  const [openUpPersonalInfo,setOpenUpPersonalInfo] = useState(false)
  const [openUpCustomerSupport,setOpenUpCustomerSupport] = useState(false)
  const [signOutLoading,setSignOutLoading] = useState(false)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)

  const { signOut } = useAuth()
  const {user} = useUser()
  const router = useRouter()

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const handleSignOut = async () => {
    try {
      setSignOutLoading(true)
      await signOut();
      router.replace('/(auth)/login')
    } catch (error) {
      createAlert('خطأ أثناء تسجيل الخروج')
    } finally {
      setSignOutLoading(false)
    }
  };

  // Ask users first if they really want to delete their account
  const confirmDeleteAccount = () => {
    Alert.alert(
      'تاكيد مسح الحساب', // Title
      'هل ترغب فعلا في مسح حسابك', // Message
      [
        {
          text: 'الغاء',
          style: 'cancel', // Cancels the alert
        },
        {
          text: 'تاكيد', // If the user confirms, proceed with deletion
          style: 'destructive', // Styling to indicate it's a destructive action
          onPress: handleDeleteAccount, // Call the delete function if user confirms
        },
      ],
      { cancelable: true } // Allow dismissal by tapping outside
    );
  };

  const handleDeleteAccount = () => {
    
  }

  /*
  const handleDeleteAccount = async () => {
    try {
      setDeleteAccountLoading(true);
      // Step 1: Delete user from Clerk
      await user.delete(); // Deletes the current user from Clerk

      // Step 2: Delete user data from Firebase Firestore
      const userInfoCollectionRef = collection(DB, 'users');
      const q = query(userInfoCollectionRef, where('user_id', '==', user.id));
      const userDocs = await getDocs(q);

      if (!userDocs.empty) {
        // Deleting all user's related data
        const userDocRef = userDocs.docs[0].ref;
        await deleteDoc(userDocRef);
      }

      // Step 3: Log out user and redirect
      await signOut();
      router.replace('/welcome'); // Redirect to login or another screen

      createAlert('تم مسح حسابك بنجاح');
    } catch (error) {
      console.error('Error deleting account:', error);
      createAlert('حدث خطأ أثناء مسح الحساب');
    }finally{
      setDeleteAccountLoading(false);
    }
  };
  */

  const openPrivacyPolicy = () => {
    Linking.openURL('https://sayartech.com/privacy-policy');
  };
  
  const openTermsOfUse = () => {
    Linking.openURL('https://sayartech.com/terms-of-use');
  };

  const userTypeArabic = (riderType) => {
    if(riderType === 'rider') {
      return 'راكب'
    } else if (riderType === 'driver') {
      return 'سائق'
    }
  }

  //Loading 
  if (fetchingUserDataLoading || deleteAccountLoading || signOutLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    );
  }

   return (
    <SafeAreaView style={styles.container}>
      <View style={styles.profile_header}>
        <Text style={styles.profile_header_text}>{userData.user_full_name} {userData.user_family_name}</Text>
      </View>
      <View style={styles.profile_main}>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={() => setOpenUpPersonalInfo(true)}>
          <Text style={styles.profile_main_box_button_text}>المعلومات الشخصية</Text>
          <FontAwesome5 name="user" size={20} color="black" />
        </TouchableOpacity>
        <Modal
          animationType="fade"
          transparent={true}
          visible={openUpPersonalInfo}
          onRequestClose={() => setOpenUpPersonalInfo(false)}
        >
          <View style={styles.personal_info_container}> 
            <View style={styles.personal_info_box}>
              <View style={styles.personal_info_box_header}>
                <Text style={styles.personal_info_box_header_text}>المعلومات الشخصية</Text>
                <TouchableOpacity onPress={() => setOpenUpPersonalInfo(false)}>
                  <AntDesign name="closecircleo" size={20} color="black" />
                </TouchableOpacity>
              </View>
              <View style={styles.personal_info_box_main}>
                <View style={styles.personal_info_box_main_box}>
                  <Text style={styles.personal_info_box_main_box_text}>الاسم و اللقب:</Text>
                  <Text style={styles.personal_info_box_main_box_text}>{userData?.user_full_name} {userData?.user_family_name}</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <Text style={styles.personal_info_box_main_box_text}>نوع الحساب:</Text>
                  <Text style={styles.profile_main_box_button_text}>{userTypeArabic(userData?.compte_owner_type)}</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <Text style={styles.personal_info_box_main_box_text}>رقم الهاتف:</Text>
                  <Text style={styles.profile_main_box_button_text}>{userData?.phone_number}</Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={() => setOpenUpCustomerSupport(true)}>
          <Text style={styles.profile_main_box_button_text}>خدمة العملاء</Text>
          <Ionicons name="help-buoy-outline" size={24} color="black" />
        </TouchableOpacity>
        <Modal
          animationType="fade"
          transparent={true}
          visible={openUpCustomerSupport}
          onRequestClose={() => setOpenUpCustomerSupport(false)}
        >
          <View style={styles.personal_info_container}> 
            <View style={styles.personal_info_box}>
              <View style={styles.personal_info_box_header}>
                <Text style={styles.personal_info_box_header_text}>تواصل معنا</Text>
                <TouchableOpacity onPress={() => setOpenUpCustomerSupport(false)}>
                  <AntDesign name="closecircleo" size={20} color="black" />
                </TouchableOpacity>
              </View>
              <View style={styles.personal_info_box_main}>
                <View style={styles.personal_info_box_main_box}>
                  <FontAwesome name="whatsapp" size={24} color="black" />
                  <Text style={styles.personal_info_box_main_box_text}>+964 771 420 0085</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <Fontisto name="email" size={24} color="black" />
                  <Text style={styles.profile_main_box_button_text}>support@sayartech.com</Text>
                </View>
                <View style={styles.personal_info_box_main_box}>
                  <SimpleLineIcons name="location-pin" size={24} color="black" />
                  <Text style={styles.profile_main_box_button_text}>الفلوجة - الانبار - العراق</Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={openPrivacyPolicy}>
          <Text style={styles.profile_main_box_button_text}>سياسة الخصوصية</Text>
          <AntDesign name="Safety" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={openTermsOfUse}>
          <Text style={styles.profile_main_box_button_text}>شروط الاستخدام</Text>
          <AntDesign name="profile" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={handleSignOut}>
          <Text style={styles.profile_main_box_button_text}>تسجيل الخروج</Text>
          <MaterialIcons name="logout" size={24} color="black" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.profile_main_box_button} onPress={confirmDeleteAccount}>
          <Text style={styles.profile_main_box_button_text}>حذف الحساب</Text>
          <Ionicons name="trash-outline" size={24} color="#DC2525" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}
export default profile

const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container:{
    flex:1,
    alignItems:'center',
    backgroundColor: colors.WHITE,
  },  
  profile_header:{
    width:SCwidth,
    height:80,
    alignItems:'center',
    justifyContent:'center',
  },
  profile_header_text:{
    fontSize: 16,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 40,
    textAlign: 'center',
  },
  profile_main:{
    width:SCwidth,
    height:SCheight - 150,
    alignItems:'center',
    justifyContent:'center',
  },
  profile_main_box_button:{
    width:300,
    height:70,
    flexDirection:'row',
    justifyContent:'flex-end',
    alignItems:'center',
    gap:10,
    borderBottomColor:colors.GRAY,
    borderBottomWidth:1,
  },
  profile_main_box_button_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 50,
  },
  personal_info_container:{
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  personal_info_box:{
    width: '90%',
    height:450,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical:10,
    alignItems: 'center',
  },
  personal_info_box_header:{
    height:50,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:10,
  },
  personal_info_box_header_text:{
    fontFamily: 'Cairo_700Bold',
    lineHeight: 50,
    textAlign: 'center',
  },
  personal_info_box_main:{
    marginTop:50,
    alignItems:'center',
    justifyContent:'center',
  },
  personal_info_box_main_box:{
    width:300,
    height:70,
    flexDirection:'row-reverse',
    justifyContent:'flex-start',
    alignItems:'center',
    gap:10,
    borderBottomColor:colors.GRAY,
    borderBottomWidth:1,
  },
  personal_info_box_main_box_text:{
    fontSize: 14,
    fontFamily: 'Cairo_400Regular',
    lineHeight: 50,
  },
  spinner_error_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center'
  }
})

/*
{
  "name": "sayartech",
  "main": "expo-router/entry",
  "version": "1.0.0",
  "scripts": {
    "start": "expo start",
    "reset-project": "node ./scripts/reset-project.js",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest --watchAll",
    "lint": "expo lint"
  },
  "jest": {
    "preset": "jest-expo"
  },
  "dependencies": {
    "@clerk/clerk-expo": "^2.1.0",
    "@expo-google-fonts/cairo": "^0.2.3",
    "@expo/metro-runtime": "~4.0.0",
    "@expo/vector-icons": "^14.0.2",
    "@react-native-async-storage/async-storage": "1.23.1",
    "@react-native-community/datetimepicker": "8.2.0",
    "@react-native-picker/picker": "2.9.0",
    "@react-navigation/native": "^6.0.2",
    "axios": "^1.7.7",
    "dayjs": "^1.11.13",
    "dotenv": "^16.4.5",
    "expo": "^52.0.20",
    "expo-checkbox": "~4.0.0",
    "expo-clipboard": "~7.0.1",
    "expo-constants": "~17.0.3",
    "expo-dev-client": "~5.0.19",
    "expo-device": "~7.0.1",
    "expo-font": "~13.0.2",
    "expo-image-picker": "~16.0.3",
    "expo-linking": "~7.0.3",
    "expo-local-authentication": "~15.0.1",
    "expo-location": "~18.0.4",
    "expo-media-library": "^17.0.6",
    "expo-notifications": "~0.29.11",
    "expo-router": "~4.0.15",
    "expo-secure-store": "~14.0.0",
    "expo-splash-screen": "~0.29.18",
    "expo-status-bar": "~2.0.0",
    "expo-system-ui": "~4.0.6",
    "expo-web-browser": "~14.0.1",
    "firebase": "^10.13.1",
    "haversine": "^1.1.1",
    "lottie-react-native": "^7.2.2",
    "parse": "^5.3.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-native": "0.76.5",
    "react-native-date-picker": "^5.0.7",
    "react-native-element-dropdown": "^2.12.1",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-get-random-values": "~1.11.0",
    "react-native-google-places-autocomplete": "^2.5.7",
    "react-native-maps": "1.18.0",
    "react-native-maps-directions": "^1.9.0",
    "react-native-permissions": "^4.1.5",
    "react-native-phone-call": "^1.2.0",
    "react-native-qrcode-svg": "^6.3.15",
    "react-native-reanimated": "~3.16.1",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-svg": "15.8.0",
    "react-native-swiper": "^1.6.0",
    "react-native-switch": "^1.5.1",
    "react-native-view-shot": "^4.0.3",
    "react-native-web": "~0.19.13",
    "referral-codes": "^3.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.25.2",
    "@types/jest": "^29.5.12",
    "@types/react": "~18.3.12",
    "@types/react-test-renderer": "^18.0.7",
    "jest": "~29.7.0",
    "jest-expo": "^52.0.0",
    "react-native-dotenv": "^3.4.11",
    "react-test-renderer": "18.2.0",
    "typescript": "^5.3.3"
  },
  "private": true
}

*/








/*
{
  "name": "sayartech",
  "version": "1.0.0",
  "main": "expo-router/entry",
  "private": true,
  "scripts": {
    "start": "expo start",
    "reset-project": "node ./scripts/reset-project.js",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "test": "jest --watchAll",
    "lint": "expo lint"
  },
  "jest": {
    "preset": "jest-expo"
  },
  "dependencies": {
    "@clerk/clerk-expo": "^2.14.4",
    "@expo-google-fonts/cairo": "^0.4.1",
    "@expo/metro-runtime": "~5.0.4",
    "@expo/vector-icons": "^14.1.0",
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-native-community/datetimepicker": "8.4.2",
    "@react-native-picker/picker": "2.11.1",
    "@react-navigation/native": "^7.1.14",
    "axios": "^1.10.0",
    "buffer": "^6.0.3",
    "dayjs": "^1.11.13",
    "dotenv": "^17.2.0",
    "expo": "^53.0.19",
    "expo-auth-session": "4.0.0",
    "expo-checkbox": "~4.1.4",
    "expo-clipboard": "~7.1.5",
    "expo-constants": "~17.1.7",
    "expo-dev-client": "~5.2.4",
    "expo-device": "~7.1.4",
    "expo-font": "~13.3.2",
    "expo-image-picker": "~16.1.4",
    "expo-linking": "~7.1.7",
    "expo-local-authentication": "~16.0.5",
    "expo-location": "~18.1.6",
    "expo-media-library": "~17.1.7",
    "expo-notifications": "~0.31.4",
    "expo-router": "~5.1.3",
    "expo-secure-store": "~14.2.3",
    "expo-splash-screen": "~0.30.10",
    "expo-status-bar": "~2.2.3",
    "expo-system-ui": "~5.0.10",
    "expo-web-browser": "~14.2.0",
    "firebase": "^11.10.0",
    "haversine": "^1.1.1",
    "lottie-react-native": "^7.2.4",
    "parse": "^6.1.1",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "react-native": "0.80.1",
    "react-native-date-picker": "^5.0.13",
    "react-native-element-dropdown": "^2.12.4",
    "react-native-gesture-handler": "~2.27.1",
    "react-native-get-random-values": "~1.11.0",
    "react-native-google-places-autocomplete": "^2.5.7",
    "react-native-maps": "1.24.5",
    "react-native-maps-directions": "^1.9.0",
    "react-native-permissions": "^5.4.1",
    "react-native-phone-call": "^1.2.0",
    "react-native-qrcode-svg": "^6.3.15",
    "react-native-reanimated": "~3.18.0",
    "react-native-safe-area-context": "5.5.2",
    "react-native-screens": "~4.11.1",
    "react-native-svg": "15.12.0",
    "react-native-swiper": "^1.6.0",
    "react-native-switch": "^1.5.1",
    "react-native-view-shot": "^4.0.3",
    "react-native-web": "~0.20.0",
    "referral-codes": "^3.0.0"
  },
  "devDependencies": {
    "@babel/core": "^7.28.0",
    "@types/jest": "^30.0.0",
    "@types/react": "~19.1.8",
    "@types/react-test-renderer": "^19.1.0",
    "jest": "~30.0.4",
    "jest-expo": "^53.0.9",
    "react-native-dotenv": "^3.4.11",
    "react-test-renderer": "19.1.0",
    "typescript": "^5.8.3"
  }
}

*/

/*
      //"buildType": "apk",
      //"abiFilters": ["arm64-v8a", "armeabi-v7a"]
*/
