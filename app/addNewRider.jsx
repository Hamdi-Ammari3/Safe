import {Alert,StyleSheet,Text,View,TouchableOpacity,TextInput,ActivityIndicator,Platform,Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import {useState,useEffect} from 'react'
import { useRouter,useLocalSearchParams } from 'expo-router'
import colors from '../constants/Colors'
import { DB } from '../firebaseConfig'
import { addDoc,collection } from 'firebase/firestore'
import MapView from 'react-native-maps'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import 'react-native-get-random-values'
import haversine from 'haversine'
import * as Location from 'expo-location'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Dropdown } from 'react-native-element-dropdown'
import Ionicons from '@expo/vector-icons/Ionicons'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import AntDesign from '@expo/vector-icons/AntDesign'

const addData = () => {
  const {riderFamily,riderUserDocId,riderUserId,riderPhone,riderNotification} = useLocalSearchParams()
  const router = useRouter()
  const GOOGLE_MAPS_APIKEY = ''

  const [studentFullName,setStudentFullName] = useState('')
  const [showBirthdayPicker,setShowBirthdayPicker] = useState(false)
  const [studentBirthDate,setStudentBirthDate] = useState(new Date())
  const [studentSex,setStudentSex] = useState('')
  const [destination,setDestination] = useState('')
  const [destinationLocation,setDestinationLocation] = useState(null)
  const [dateSelected, setDateSelected] = useState(false)
  const [openLocationModal,setOpenLocationModal] = useState(false)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [homeCoords,setHomeCoords] = useState(null)
  const [homeAddress,setHomeAddress] = useState('')
  const [distanceInKm, setDistanceInKm] = useState(null)
  const [addingNewStudentLoading,setAddingNewStudentLoading] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Get the student birth date
  const showBirthDayDatePicker = () => {
    setShowBirthdayPicker(true);
  }
  
  // Handle the BirthDate Change
  const handleBirthDayDateChange = (event, selectedDate) => {
    if (event.type === "set" && selectedDate) {
      setStudentBirthDate(selectedDate);
      setDateSelected(true);
    }
    if (Platform.OS === "android") {
      setShowBirthdayPicker(false)
    }
  }

  // Close the picker manually for iOS
  const closePicker = () => {
    setShowBirthdayPicker(false)
  }

  // Student Sex
  const sex = [
    { name: 'ذكر'},
    {name:'انثى'}
  ]

  // Handle student sex change
  const handleStudentSex = (sexType) => {
    setStudentSex(sexType)
  }
  
  //Pick rider home location
  const getLocation = async () => {
    Alert.alert(
      "مطلوب إذن الموقع",
      "يستخدم تطبيق Safe موقعك لحفظ عنوان المنزل بدقة. لن نستخدم بيانات موقعك في الخلفية أو نشاركها مع أي طرف ثالث.",
      [
        {
          text: "إلغاء",
          style: "cancel",
        },
        {
          text: "موافق",
          onPress: async () => {
            setLoadingLocation(true);
            setOpenLocationModal(true); 
            try {
              // Request permission
              const { status } = await Location.requestForegroundPermissionsAsync();

              if (status !== "granted") {
                createAlert("عذراً، لا يمكننا الوصول إلى موقعك بدون إذن");
                setOpenLocationModal(false);
                return;
              }

              // Give time for GPS to initialize after enabling
              await new Promise(resolve => setTimeout(resolve, 1000));

              let location;
              try {
                location = await Location.getCurrentPositionAsync({});
              } catch (err) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                location = await Location.getCurrentPositionAsync({});
              }

              const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              };

              setHomeCoords(coords);
            } catch (error) {
              createAlert("تعذر الحصول على الموقع. حاول مرة أخرى.");
              setOpenLocationModal(false);
            } finally {
              setLoadingLocation(false); // stop loading indicator
            }
          },
        },
      ]
    );
  }

  //Save location value
  const saveLocationValue = async() => {
    if (homeCoords) {
      try {
        const addressData = await Location.reverseGeocodeAsync(homeCoords);
        if (addressData.length > 0) {
          const addr = addressData[0];
          const fullAddress = `${addr.city || ''}, ${addr.region || ''}`;
          setHomeAddress(fullAddress);
        }
        setOpenLocationModal(false);
      } catch (error) {
        alert("حدث خطأ أثناء جلب العنوان.");
        console.log(error)
      }      
    } else {
      alert("يرجى تحديد الموقع أولا.");
    }
  }

  //Close location pick modal
  const closePickLocationModal = () => {
    setOpenLocationModal(false)
  }

  //Calculate distance between home and destination
  useEffect(() => {
    if (homeCoords && destinationLocation) {
      const distance = haversine(homeCoords, destinationLocation, { unit: 'km' })
      setDistanceInKm(parseFloat(distance.toFixed(2)))
    }
  }, [homeCoords, destinationLocation])

  //Come back to home screen
  const comeBackToHome = () => {
    router.push('/(main)/(rider)/(tabs)/home')  
  }

  //Adding new rider
  const addNewRiderHandler = async () => {
    
    if (!destination) return createAlert('يرجى ادخال مكان الدراسة / العمل')
    if (!studentFullName) return createAlert('يرجى ادخال الاسم')
    if (!dateSelected) return createAlert("يرجى إدخال تاريخ الميلاد")
    if (!studentSex) return createAlert("يرجى تحديد الجنس")
    if (!homeCoords) return createAlert("يرجى تحديد عنوان المنزل")

    setAddingNewStudentLoading(true)

    try {
      const studentData = {
        full_name: studentFullName,
        family_name:riderFamily,
        user_id:riderUserId,
        user_doc_id:riderUserDocId,
        phone_number:riderPhone,
        user_notification_token:riderNotification,
        birth_date:studentBirthDate,
        sex:studentSex,
        home_address:homeAddress,
        home_location:homeCoords,
        destination:destination,
        destination_location:destinationLocation,
        distance:distanceInKm,
        company_commission:0,
        driver_commission:0,
        line_id:null,
        driver_id:null,
        trip_status:'at home',
        checked_at_home:false,
      }

      const studentsCollectionRef = collection(DB,'riders')
      const docRef = await addDoc(studentsCollectionRef,studentData)

      createAlert('تم تسجيل المعلومات بنجاح')
      
      // Clear the form fields
      setStudentFullName('')
      setDateSelected(false)
      setStudentBirthDate(new Date())
      setStudentSex('')
      setHomeCoords(null)
      setHomeAddress('')

    } catch (error) {
      createAlert('. يرجى المحاولة مرة أخرى')
      console.log(error)
    } finally{
      setAddingNewStudentLoading(false)
      router.push('/(main)/(rider)/(tabs)/home')  
    }
  }

  if (addingNewStudentLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  return(
    <SafeAreaView style={styles.container}>
      <View style={styles.title}>
        <Text style={styles.titleText}>اضافة راكب</Text>
        <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
          <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <View style={styles.form}>
        <View>
          <GooglePlacesAutocomplete
            placeholder="عنوان الدراسة / العمل"
            query={{
              key: GOOGLE_MAPS_APIKEY,
              language: 'ar',
              components: 'country:iq',
            }}
            onPress={(data, details = null) => {
              if (details) {
                const loc = {
                  latitude: details?.geometry?.location?.lat,
                  longitude: details?.geometry?.location?.lng,
                }
                setDestination(data?.description)
                setDestinationLocation(loc)
              }
            }}
            autoFillOnNotFound={false}
            currentLocation={false}
            currentLocationLabel="Current location"
            debounce={0}
            disableScroll={false}
            enableHighAccuracyLocation={true}
            enablePoweredByContainer={true}
            fetchDetails={true}
            filterReverseGeocodingByTypes={[]}
            GooglePlacesDetailsQuery={{}}
            //GooglePlacesSearchQuery={{
              //rankby: 'distance',
              //type: 'restaurant',
            //}}
            GoogleReverseGeocodingQuery={{}}
            isRowScrollable={true}
            keyboardShouldPersistTaps="always"
            listUnderlayColor="#c8c7cc"
            listViewDisplayed="auto"
            keepResultsAfterBlur={false}
            minLength={1}
            nearbyPlacesAPI="GooglePlacesSearch"
            numberOfLines={1}
            onFail={() => {
              console.log('Autocomplete failed');
            }}
            onNotFound={() => {
              console.log('No results found');
            }}
            onTimeout={() =>
              console.log('Google Places Autocomplete: Request timeout')
            }
            predefinedPlaces={[]}
            predefinedPlacesAlwaysVisible={false}
            suppressDefaultStyles={false}
            textInputHide={false}
            timeout={20000}
            textInputProps={{
              placeholderTextColor: colors.BLACK,
            }}
            styles={{
              container: {
                flex: 0,
                width:300,
                zIndex: 999,
              },
              textInput: {
                height:47,
                marginBottom:10,
                borderWidth:1,
                borderColor:colors.BLACK,
                borderRadius:15,
                color:colors.BLACK,
                textAlign:'center',
                fontFamily:'Cairo_400Regular',
              },
              listView: { 
                backgroundColor: 'white' ,
                maxHeight: 185,
                borderRadius: 10,
                zIndex: 10,
                elevation: 5,
              },
            }}
          />
        </View>
        <TextInput
          style={styles.customeInput}
          placeholderTextColor={colors.BLACK}
          placeholder="الاسم"
          value={studentFullName}
          onChangeText={(text) => setStudentFullName(text)}
        />
        <TouchableOpacity style={styles.fullButton} onPress={showBirthDayDatePicker}>
          <Text style={styles.fullBtnText}>
            {dateSelected ? studentBirthDate.toLocaleDateString() : 'تاريخ الميلاد'}
          </Text>
        </TouchableOpacity>
        {showBirthdayPicker && (
            <Modal transparent animationType="slide" visible={showBirthdayPicker}>
              <View style={styles.modalContainer}>
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={studentBirthDate}
                    mode="date"
                    display="spinner"
                    onChange={handleBirthDayDateChange}
                    maximumDate={new Date()}
                  />
                  <TouchableOpacity onPress={closePicker} style={styles.doneButton}>
                    <Text style={styles.doneButtonText}>تأكيد</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
        )}
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.dropdownStyle}
          selectedTextStyle={styles.dropdownStyle}
          itemTextStyle={styles.dropdownTextStyle}
          data={sex}
          labelField="name"
          valueField="name"
          placeholder="الجنس"
          value={studentSex}
          onChange={item => handleStudentSex(item.name)}
        />
        <TouchableOpacity style={styles.fullButton} onPress={getLocation}>
          <Ionicons name="location-outline" size={24} style={styles.icon} />
          <Text style={styles.fullBtnText}>
            {homeAddress ? homeAddress : 'عنوان المنزل'}
          </Text>
        </TouchableOpacity>
        <Modal
          animationType="fade"
          transparent={true} 
          visible={openLocationModal} 
          onRequestClose={closePickLocationModal}
        >
          <View style={styles.modal_container}>
            <View style={styles.modal_box}>
              <View style={styles.modal_header}>
                <TouchableOpacity onPress={closePickLocationModal}>
                  <AntDesign name="closecircleo" size={24} color="gray" />
                </TouchableOpacity>
                <Text style={styles.modal_title}>العنوان</Text>
              </View>
              <View style={styles.mapContainer}>
                {loadingLocation ? (
                  <View style={styles.loading_location}>
                    <Text style={styles.loading_location_text}>جاري تحديد موقعك ...</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.mapControls}>
                      <TouchableOpacity 
                        style={styles.save_location_button} 
                        onPress={saveLocationValue}
                      >
                        <Text style={styles.save_location_button_text}>حفظ الموقع</Text>
                      </TouchableOpacity>
                    </View>
                    <MapView
                      provider="google"
                      style={styles.map}                    
                      initialRegion={{
                        latitude: homeCoords?.latitude || 33.3152,
                        longitude: homeCoords?.longitude || 44.3661,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }}
                      showsUserLocation={true}
                      showsMyLocationButton={true}
                      onRegionChangeComplete={(reg) => {
                        setHomeCoords({
                          latitude: reg.latitude,
                          longitude: reg.longitude,
                        });
                      }}
                    />
                    <View style={styles.centerPin}>
                      <FontAwesome6 name="map-pin" size={24} color="red" />
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal> 
        {distanceInKm && (
          <Text style={styles.distance_text}>
            المسافة بين المنزل والوجهة: {distanceInKm} كم
          </Text>
        )}  
        <TouchableOpacity 
          style={styles.finalButton} 
          onPress={addNewRiderHandler}
          disabled={addingNewStudentLoading}
        >
          <Text style={styles.finalButtonText}>أضف</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

export default addData


const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:colors.WHITE,
  },
  title:{
    width:'100%',
    height:100,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:20,
    marginBottom:50,
  },
  titleText:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    fontSize:24,
    textAlign:'center',
  },
  arrowBackFunction:{
    height:40,
    alignItems:'center',
    justifyContent:'center',
  },
  form:{
    width:'100%',
    justifyContent:'center',
    alignItems:'center',
  },
  customeInput:{
    width:300,
    height:50,
    marginBottom:10,
    borderWidth:1,
    borderColor:colors.BLACK,
    borderRadius:15,
    color:colors.BLACK,
    textAlign:'center',
    fontFamily:'Cairo_400Regular'
  },
  dropdown:{
    width:300,
    height:50,
    borderWidth:1,
    marginBottom:10,
    borderColor:colors.BLACK,
    borderRadius:15,
  },
  dropdownStyle:{
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  fullButton:{
    width:300,
    height:50,
    marginBottom:10,
    borderColor:colors.BLACK,
    borderWidth:1,
    borderRadius:15,
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },  
  fullBtnText:{
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.BLACK,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerContainer: {
    backgroundColor: colors.DARKGRAY,
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    alignItems:'center',
    justifyContent:'center'
  },
  doneButton: {
    width:100,
    marginTop: 10,
    backgroundColor: colors.PRIMARY,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 5,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  icon:{
    marginRight:10,
  },
  BtnHalfContainer:{
    width:280,
    flexDirection:'row',
    justifyContent:'center',
  },
  finalButton:{
    width:120,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    marginTop:0,
    borderRadius:15,
    backgroundColor:colors.DARKBLUE
  },
  finalButtonText:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    color:colors.WHITE
  },
  modal_container:{
    flex:1,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal_box:{
    width: '95%',
    height:600,
    backgroundColor:colors.WHITE,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  modal_header:{
    width:'100%',
    height:40,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  modal_title:{
    lineHeight:40,
    fontFamily:'Cairo_700Bold',
    fontSize:15,
    marginLeft:10,
  },
  mapContainer:{
    width:'100%',
    height:540,
  },
  loading_location:{
    width:'100%',
    height:'100%',
    justifyContent: 'center',
    alignItems:'center'
  },
  loading_location_text:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
  },
  map:{
    width:'100%',
    height:'100%',
  },
  mapControls: {
    width:'100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap:10,
    position:'absolute',
    top:5,
    left:0,
    zIndex:5,
  },
  smallButton: {
    height:40,
    width:120,
    borderRadius: 8,
    backgroundColor: 'gray',
    flexDirection:'row',
    justifyContent:'center',
    alignItems: 'center',
  },
  smallButtonText: {
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    color:colors.WHITE
  },
  save_location_button:{
    height:40,
    width:120,
    borderRadius: 8,
    backgroundColor: colors.BLUE,
    flexDirection:'row',
    justifyContent:'center',
    alignItems: 'center',
  },
  save_location_button_text:{
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    color:colors.WHITE
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40, 
    zIndex: 10,
  },
  distance_text:{
    textAlign: 'center', 
    marginVertical: 10, 
    color: colors.BLACK, 
    fontFamily: 'Cairo_400Regular'
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})