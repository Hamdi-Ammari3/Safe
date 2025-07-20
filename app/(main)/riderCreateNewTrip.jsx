import {useState} from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert,StyleSheet,Text,View,ActivityIndicator,TouchableOpacity,TextInput,Platform,Modal,Dimensions } from 'react-native'
import MapView from 'react-native-maps'
import * as Location from 'expo-location'
import { useRouter,useLocalSearchParams } from 'expo-router'
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete'
import 'react-native-get-random-values'
import { Dropdown } from 'react-native-element-dropdown'
import DateTimePicker from '@react-native-community/datetimepicker'
import { collection,Timestamp,doc,arrayUnion,writeBatch } from 'firebase/firestore'
import { DB } from '../../firebaseConfig'
import dayjs from "dayjs"
import colors from '../../constants/Colors'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5'
import FontAwesome6 from '@expo/vector-icons/FontAwesome6'
import AntDesign from '@expo/vector-icons/AntDesign'

const riderCreateNewTrip = () => {
  const router = useRouter()
  const GOOGLE_MAPS_APIKEY = ''
  const {riderData} = useLocalSearchParams()
  const parsedRiderData = JSON.parse(riderData)
  const account_balance = Number(parsedRiderData.account_balance)

  const totalSteps = 2
  const [currentPage, setCurrentPage] = useState(1)
  const [openLocationModal,setOpenLocationModal] = useState(false)
  const [loadingLocation, setLoadingLocation] = useState(false)
  const [homeCoords,setHomeCoords] = useState(null)
  const [homeAddress,setHomeAddress] = useState('')
  const [homeCity,setHomeCity] = useState('')
  const [endPoint,setEndPoint] = useState('')
  const [endCity,setEndCity] = useState('')
  const [datePart, setDatePart] = useState(new Date())
  const [timePart, setTimePart] = useState(new Date())
  const [startDateTime, setStartDateTime] = useState(null)
  const [pickerMode, setPickerMode] = useState(null)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [seatsNumber,setSeatsNumber] = useState('')
  const [carType,setCarType] = useState('')
  const [seatPrice,setSeatPrice] = useState('')
  const [rawSeatPrice, setRawSeatPrice] = useState('')
  const [addingNewTripLoading,setAddingNewTripLoading] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  //Come back to home screen
  const comeBackToHome = () => {
    router.push('/riderDailyTripsMain')  
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
          setHomeCity(addr.city)
          setHomeAddress(fullAddress)
        }
        setOpenLocationModal(false)
      } catch (error) {
        alert("حدث خطأ أثناء جلب العنوان.");
        console.log(error)
      }      
    } else {
      alert("يرجى تحديد الموقع بدقة.");
    }
  }
  
  //Close location pick modal
  const closePickLocationModal = () => {
    setOpenLocationModal(false)
  }
  
  //Open date picker
  const openDatePicker = () => {
    setPickerMode('date');
    setPickerVisible(true);
  }

  //Open time picker
  const openTimePicker = () => {
    setPickerMode('time');
    setPickerVisible(true);
  }

  //Handle change date
  const handlePickerChange = (event, selected) => {
    if (Platform.OS === 'ios') {
      if (selected) {
        if (pickerMode === 'date') setDatePart(selected);
        if (pickerMode === 'time') setTimePart(selected);
      }
    } else {
      setPickerVisible(false);
      if (event.type === 'set' && selected) {
        let newDatePart = datePart;
        let newTimePart = timePart;

        if (pickerMode === 'date') {
          newDatePart = selected;
          setDatePart(newDatePart);
        }

        if (pickerMode === 'time') {
          newTimePart = selected;
          setTimePart(newTimePart);
        }
        const combined = new Date(newDatePart);
        combined.setHours(newTimePart.getHours());
        combined.setMinutes(newTimePart.getMinutes());
        combined.setSeconds(0);
        setStartDateTime(combined);
      }
    }
  }

  //Confirm date selection
  const confirmIosPicker = () => {
    setPickerVisible(false);
    const combined = new Date(datePart);
    combined.setHours(timePart.getHours());
    combined.setMinutes(timePart.getMinutes());
    setStartDateTime(combined);
  }

  //Format price input
  const formatNumberWithCommas = (value) => {
    if (!value) return '';
    const numberOnly = value.replace(/[^0-9]/g, '');
    return Number(numberOnly).toLocaleString(); // adds commas automatically
  }

  //lines Cars type
  const carsList = [
    {name: 'صالون'},
    {name:'ميني باص ١٢ راكب'},
    {name:'ميني باص ١٨ راكب'},
    {name:'٧ راكب (جي ام سي / تاهو)'}
  ]

  // Handle the car type change
  const handleCarChange = (vehicle) => {
    setCarType(vehicle)
  }

  // Go to next page
  const handleNext = () => {
    if (currentPage < totalSteps) setCurrentPage(currentPage + 1);
  }

  // Return to previous page
  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  }

  //Create new intercity trip
  const createNewTrip = async() => {
    if(!parsedRiderData) return
    if(!homeCoords) return createAlert('يرجى تحديد مكان الانطلاق')
    if(!endPoint) return createAlert('يرجى تحديد مكان الوصول')
    if(!startDateTime) return createAlert('يرجى تحديد تاريخ و وقت الانطلاق')
    if(!seatsNumber || isNaN(seatsNumber)) return createAlert('يرجى تحديد عدد الركاب')
    if(!rawSeatPrice || isNaN(rawSeatPrice)) return createAlert('يرجى تحديد الثمن')

    // Define trip fee
    const companyCommission = 1500
    const totalTripCost = Number(rawSeatPrice) + Number(companyCommission)

    if (account_balance < totalTripCost) {
      return createAlert(`الرصيد غير كافٍ لإنشاء الرحلة. المبلغ المطلوب هو ${totalTripCost.toLocaleString()} د.ع. يرجى تعبئة الرصيد.`);
    }

    setAddingNewTripLoading(true)

    try {
      const tripData = {
        created_by:'rider',
        trip_creator:parsedRiderData.user_full_name,
        trip_creator_id:parsedRiderData.id,
        start_point:homeAddress,
        start_city:homeCity,
        destination_address:endPoint,
        destination_city:endCity,
        start_datetime: Timestamp.fromDate(startDateTime),
        driver_name:null,
        driver_id:null,
        driver_notification:null,
        driver_phone:null,
        car_type:carType,
        car_modal:null,
        car_plate:null,
        seats_booked: Number(seatsNumber),
        seat_price: Number(rawSeatPrice),
        company_commission:1500,
        riders:[{
          id: parsedRiderData.id,
          name:parsedRiderData.user_full_name,
          location:homeCoords,
          phone:parsedRiderData.phone_number,
          notification:parsedRiderData.user_notification_token,
          seats_booked: Number(seatsNumber),
          seats_booked_price: Number(rawSeatPrice),
          total_price: Number(totalTripCost),
          picked_check:false,
          picked:false
        }],
        rider_ids:[parsedRiderData.id],
        started:false,
        canceled:false,
        payed:false
      }

      const intercityTripsRef = doc(collection(DB,'intercityTrips'))
      const userRef = doc(DB, 'users', parsedRiderData.id)
      const batch = writeBatch(DB)

      batch.set(intercityTripsRef, tripData)

      batch.update(userRef, {
        account_balance: account_balance - totalTripCost,
        intercityTrips: arrayUnion({
          id:intercityTripsRef.id,
          picked:false,
          canceled:false
        })
      })
      await batch.commit();
      createAlert('تم اضافة الرحلة بنجاح')
    } catch (error) {
      createAlert('. يرجى المحاولة مرة أخرى')
      console.log(error)
    } finally {
      setAddingNewTripLoading(false)
      router.push('/riderDailyTripsMain') 
    }
  }

  //Adding new trip loading
  if (addingNewTripLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY}/>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.title}>
        <Text style={styles.titleText}>إنشاء رحلة</Text>
        <TouchableOpacity style={styles.arrowBackFunction} onPress={comeBackToHome}>
          <FontAwesome5 name="arrow-circle-left" size={24} color="black" />
        </TouchableOpacity>
      </View>
      <View style={styles.form}>
        <TouchableOpacity
          style={styles.location_button} 
          onPress={getLocation}
        >
          {homeAddress ? (
            <Text style={styles.location_button_text}>{homeAddress}</Text>
          ) : (
            <Text style={styles.location_button_text}>مكان الانطلاق</Text>
          )}
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
                <Text style={styles.modal_title}>نقطة الانطلاق</Text>
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
                        })
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
        <View>
          <GooglePlacesAutocomplete
            placeholder="مكان الوصول"
            query={{
              key: GOOGLE_MAPS_APIKEY,
              language: 'ar',
              components: 'country:iq',
            }}
            onPress={(data, details = null) => {
              if (details) {
                setEndPoint(data.description)
                const cityComponent = details.address_components.find((comp) =>
                  comp.types.includes("locality") || comp.types.includes("administrative_area_level_1")
                )
                if (cityComponent) {
                  setEndCity(cityComponent.long_name)
                }
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
        <View style={styles.two_horizental_inputs_box}>
          <TouchableOpacity onPress={openDatePicker} style={styles.customeInput}>
            <Text style={styles.customeInput_text}>
              {startDateTime ? dayjs(startDateTime).format('YYYY-MM-DD') : 'التاريخ'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openTimePicker} style={styles.customeInput}>
            <Text style={styles.customeInput_text}>
              {startDateTime ? dayjs(startDateTime).format('HH:mm') : 'الوقت'}
            </Text>
          </TouchableOpacity>
          {pickerVisible && (
            Platform.OS === 'ios' ? (
              <Modal transparent animationType="slide" visible={pickerVisible}>
                <View style={styles.modalContainer}>
                  <View style={styles.pickerContainer}>
                    <DateTimePicker
                      value={pickerMode === 'date' ? datePart : timePart}
                      mode={pickerMode}
                      display="spinner"
                      onChange={handlePickerChange}
                      is24Hour={false}
                    />
                    <TouchableOpacity onPress={confirmIosPicker} style={styles.doneButton}>
                      <Text style={styles.doneButtonText}>تأكيد</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            ) : (
              <DateTimePicker
                value={pickerMode === 'date' ? datePart : timePart}
                mode={pickerMode}
                display="spinner"
                onChange={handlePickerChange}
                is24Hour={false}
              />
            )
          )}
        </View>
        <Dropdown
          style={styles.dropdown}
          placeholderStyle={styles.dropdownStyle}
          selectedTextStyle={styles.dropdownStyle}
          itemTextStyle={styles.dropdownTextStyle}
          data={carsList}
          labelField="name"
          valueField="name"
          placeholder= 'نوع السيارة'
          value={carType}
          onChange={item => {
            handleCarChange(item.name)
          }}
        />
        <View style={styles.two_horizental_inputs_box}>
          <TextInput
            style={styles.customeInput}
            placeholderTextColor={colors.BLACK}
            placeholder="عدد الركاب"
            keyboardType="numeric"
            value={seatsNumber}
            onChangeText={(text) => setSeatsNumber(text.replace(/[^0-9]/g, ''))}
          />
          <TextInput
            style={styles.customeInput}
            placeholderTextColor={colors.BLACK}
            placeholder="السعر"
            keyboardType="numeric"
            value={seatPrice}
            onChangeText={(text) => {
              const numberOnly = text.replace(/[^0-9]/g, '');
              setRawSeatPrice(numberOnly);
              setSeatPrice(formatNumberWithCommas(numberOnly));
            }}
          />
        </View>
        <TouchableOpacity 
          style={styles.add_trip_button} 
          onPress={createNewTrip}
          disabled={addingNewTripLoading}
        >
          <Text style={styles.add_trip_button_text}>{addingNewTripLoading ? '...' :'أضف'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

export default riderCreateNewTrip

const { width: SCwidth } = Dimensions.get('window');

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:colors.WHITE,
  },
  title:{
    width:'100%',
    height:80,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:20,
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
    width:SCwidth,
    marginTop:50,
    alignItems:'center',
  },
  location_button:{
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
  location_button_text:{
    lineHeight:50,
    verticalAlign:'middle',
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    color:colors.BLACK,
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
  two_horizental_inputs_box:{
    flexDirection:'row-reverse',
    justifyContent:'center',
    alignItems:'center',
    gap:10
  },
  customeInput:{
    width:145,
    height:50,
    marginBottom:10,
    borderWidth:1,
    borderColor:colors.BLACK,
    borderRadius:15,
    color:colors.BLACK,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
    fontSize:15,
  },
  customeInput_text:{
    lineHeight:50,
    fontFamily:'Cairo_400Regular',
    fontSize:15,
    textAlign:'center',
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
    fontSize:15
  },
  dropdownTextStyle:{
    textAlign:'center',
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
    backgroundColor: '#BE9A4E',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 5,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  add_trip_button:{
    width:120,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    borderRadius:15,
    backgroundColor:colors.DARKBLUE
  },
  add_trip_button_text:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    color:colors.WHITE
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})