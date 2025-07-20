import { useState,useMemo,useCallback } from 'react'
import { StyleSheet,Text,View,ActivityIndicator,Image,TouchableOpacity,FlatList,Dimensions,TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useDriverData } from '../../../../stateManagment/DriverContext'
import { useUser } from '@clerk/clerk-expo'
import { Dropdown } from 'react-native-element-dropdown'
import dayjs from 'dayjs'
import 'dayjs/locale/ar'
import isToday from 'dayjs/plugin/isToday'
import isTomorrow from 'dayjs/plugin/isTomorrow'
import colors from '../../../../../constants/Colors'
import logo from '../../../../../assets/images/logo.jpg'
import addYourData from '../../../../../assets/images/add_your_data.png'
import notYourService from '../../../../../assets/images/nothing.png'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import FontAwesome from '@expo/vector-icons/FontAwesome'
import AntDesign from '@expo/vector-icons/AntDesign'

const dailyTrips = () => {
  const {
    userData,
    fetchingUserDataLoading,
    driverData,
    fetchingDriverDataLoading,
    myTrips,
    fetchingMyTrips,
    eligibleTrips,
    fetchingEligibleTrips,
  } = useDriverData()
  const { isLoaded } = useUser()
  const router = useRouter()
  dayjs.extend(isToday)
  dayjs.extend(isTomorrow)
  dayjs.locale('ar')

  const [activeTab, setActiveTab] = useState('myTrips')
  const tripStatusOptions = [
    { name: 'كل الرحلات' },
    { name: 'لم تبدأ بعد' },
    { name: 'بدأت' },
    { name: 'انتهت' },
  ]
  const [tripStatusFilter, setTripStatusFilter] = useState('كل الرحلات')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')

  //Redirect to add driver data page
  const redirectToAddDataPage = () => {
    router.push({
      pathname:"/addDriverData",
      params: {
        driverName: userData.user_full_name,
        driverFamily:userData.user_family_name,
        driverUserId:userData.user_id,
        driverPhone:userData.phone_number,
        driverNotification:userData.user_notification_token,
      }
    })
  }

  //Redirect to trip details page
  const redirectToTripDetailsPage = (trip,status) => {
    router.push({
      pathname:"/driverTripDetails",
      params:{
        tripID:trip.id,
        trip_status:status
      }
    })
  }

  //Redirect to create new trip
  const redirectToCreateNewTrip = () => {
    router.push({
      pathname:"/driverCreateNewTrip",
      params: {
        driverData: JSON.stringify(driverData[0])
      }
    })
  }

  //Filter driver's eligible trips
  const eligibleRequestedTrips = useMemo(() => {

    if (!driverData?.length || !eligibleTrips?.length) return [];

    const driverCarType = driverData[0].car_type;

    return eligibleTrips?.filter(trip => {
      const isFromRider = trip.created_by === 'rider';
      const sameCarType = trip.car_type === driverCarType;
      const notStarted = trip.started === false;
      return isFromRider && sameCarType && notStarted
    })
    .sort((a, b) => b.start_datetime?.toDate() - a.start_datetime?.toDate());

  }, [driverData, eligibleTrips])

  // Filter eligible trips using from - to inputs
  const filteredEligibleTrips = useMemo(() => {
    return eligibleRequestedTrips?.filter(trip => {
      const matchesFrom = fromFilter ? trip.start_point.includes(fromFilter) : true;
      const matchesTo = toFilter ? trip.destination_address.includes(toFilter) : true;
      return matchesFrom && matchesTo;
    })
  }, [eligibleRequestedTrips,fromFilter,toFilter])

  // Filter my trips using trip status
  const filteredMyTrips = useMemo(() => {
    if (!driverData?.length || !myTrips?.length) return [];

    const now = new Date();

    return myTrips?.filter(trip => {
      const hasRiders = trip.riders?.length > 0;
      const startDate = trip.start_datetime?.toDate?.() || new Date(trip.start_datetime);
      const isFutureTrip = startDate > now;

      if (!hasRiders && !isFutureTrip) {
        return false; // skip this trip
      }

      let status = 'لم تبدأ بعد';

      if (trip.started) {
        const allPicked = trip.riders?.every(r => r.picked);
        status = allPicked ? 'انتهت' : 'بدأت';
      }
      return tripStatusFilter === 'كل الرحلات' || status === tripStatusFilter;
    })
    .sort((a, b) => b.start_datetime?.toDate() - a.start_datetime?.toDate());

  }, [myTrips,tripStatusFilter])

  //Format start date and time
  const formatTripStartTime = (timestamp) => {
    if (!timestamp) return '';

    const date = dayjs(timestamp?.toDate());

    if (date.isToday()) {
      return `اليوم ${date.format('hh:mm A')}`;
    }

    if (date.isTomorrow()) {
      return `غدا ${date.format('hh:mm A')}`;
    }

    // Format: الخميس 13 يونيو 10:30 صباحا
    return date.format('dddd D MMMM hh:mm A');
  }

  // format trip amount
  const formatTripAmount = (amount) => {
    return amount?.toLocaleString('ar-IQ', {
      style: 'currency',
      currency: 'IQD',
      minimumFractionDigits: 0,
    })
  }

  //Render trips 
  const renderTripItem = useCallback(({ item }) => {
    const sameDriverID = item.driver_id === driverData[0].id;
    let tripStatus = 'لم تبدأ بعد'
    if (item.started) {
      const allRidersPicked = item.riders?.every(r => r.picked === true);
      if (allRidersPicked) {
        tripStatus = 'انتهت';
      } else {
        tripStatus = 'بدأت';
      }
    }
    const statusColor = tripStatus === 'انتهت' ? '#328E6E' : tripStatus === 'بدأت' ? '#295f98ff' : '#dd7804ff';
                    
    return (
      <View style={styles.tripBox}>
        <View style={styles.tripBox_header}>
          <Text style={styles.tripBox_header_text}>{item.trip_creator}</Text>
          <FontAwesome name="user" size={24} color="darkgray" />
        </View>
        {sameDriverID && (
          <View style={[styles.tripBox_status_box,{backgroundColor:statusColor}]}>
            <Text style={styles.tripBox_status_text}>{tripStatus}</Text>
          </View>
        )}                
        <View style={styles.tripBox_main}>
          <View style={styles.location_box}>
            <View style={styles.location_text_box}>
              <Text style={styles.trip_text_start_point_title}>الانطلاق</Text>
              <Text style={styles.trip_text_start_point}>{item?.start_point}</Text>
            </View>
            <View style={styles.location_icon_box}>
              <MaterialCommunityIcons name="map-marker-account-outline" size={24} color="black" />
            </View>
          </View>
          <View style={styles.location_box}>
            <View style={styles.location_text_box}>
              <Text style={styles.trip_text_start_point_title}>الوصول</Text>
              <Text style={styles.trip_text_start_point}>{item?.destination_address}</Text>
            </View>
            <View style={styles.location_icon_box}>
              <MaterialCommunityIcons name="map-marker-check-outline" size={24} color="black" />
            </View>
          </View>
          <View style={styles.location_box}>
            <View style={styles.location_text_box}>
              <Text style={styles.trip_text_start_point_title}>التوقيت</Text>
              <Text style={styles.trip_text_start_point}>{formatTripStartTime(item?.start_datetime)}</Text>
            </View>
            <View style={styles.location_icon_box}>
              <MaterialIcons name="access-time" size={24} color="black" />
            </View>
          </View>
        </View>
        <View style={styles.tripBox_footer}>
          <View style={[styles.tripBox_footer_section, styles.withSeparator]}>
            <Text style={styles.tripBox_footer_text_title}>السعر</Text>
            <Text style={styles.tripBox_footer_text}>{formatTripAmount(item?.seat_price)}</Text>
          </View>
          <View style={[styles.tripBox_footer_section, styles.withSeparator]}>
            <Text style={styles.tripBox_footer_text_title}>الركاب</Text>
            <Text style={styles.tripBox_footer_text}>{item?.seats_booked}</Text>
          </View>
          <View style={styles.tripBox_footer_section}>
            <TouchableOpacity onPress={() => redirectToTripDetailsPage(item,tripStatus)}>
              <Text style={styles.tripBox_footer_button_text}>التفاصيل</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }, [userData, redirectToTripDetailsPage]);

  //Loading State
  if( !isLoaded || fetchingDriverDataLoading || fetchingUserDataLoading || fetchingMyTrips ||  fetchingEligibleTrips) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_error_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    )
  }

  // if the driver haven't yet added his info
  if(!driverData?.length) {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.add_your_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.illustration_container}>
            <Image source={addYourData} style={styles.illustration}/>
          </View>
          <View style={styles.add_your_data_text_container}>
            <Text style={styles.add_your_data_text}>الرجاء اضافة بياناتك</Text>
            <TouchableOpacity style={styles.link_container} onPress={redirectToAddDataPage}>
              <Text style={styles.link_text}>اضف الآن</Text>
            </TouchableOpacity>
          </View>
        </View>        
      </SafeAreaView>
    )
  }

  // Driver service type not daily trips
  if(driverData?.length > 0 && driverData[0]?.service_type !== "رحلات يومية بين المدن") {
    return(
      <SafeAreaView style={styles.container}>
        <View style={styles.add_your_data_container}>
          <View style={styles.logo}>
            <Image source={logo} style={styles.logo_image}/>
          </View>
          <View style={styles.illustration_container}>
            <Image source={notYourService} style={styles.illustration}/>
          </View>
          <View>
            <Text style={styles.service_unavailable_text}>هذه الخدمة غير متوفرة في حسابك</Text>
          </View>
        </View>  
      </SafeAreaView>
    )
  }

  if (driverData?.length > 0 && driverData[0]?.service_type === "رحلات يومية بين المدن") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.intercity_trips_container}>
          <View style={styles.tripTabButtonsContainer}>
            <TouchableOpacity
              style={[styles.tripTabButton, activeTab === 'myTrips' && styles.activeTripTabButton]}
              onPress={() => setActiveTab('myTrips')}
            >
              <Text style={[styles.tripTabText, activeTab === 'myTrips' && styles.activeTripTabText]}>
                رحلاتي
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tripTabButton, activeTab === 'requests' && styles.activeTripTabButton]}
              onPress={() => setActiveTab('requests')}
            >
              <Text style={[styles.tripTabText, activeTab === 'requests' && styles.activeTripTabText]}>
                طلبات رحلات
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'myTrips' ? (
            <Dropdown
              style={styles.dropdown}
              placeholderStyle={styles.dropdownStyle}
              selectedTextStyle={styles.dropdownStyle}
              itemTextStyle={styles.dropdownTextStyle}
              data={tripStatusOptions}
              labelField="name"
              valueField="name"
              placeholder="كل الرحلات"
              value={tripStatusFilter}
              onChange={(item) => setTripStatusFilter(item.name)}
            />
          ) : (
            <View style={styles.fromTofilterInputContainer}>
              <TextInput
                style={styles.fromTofilterInput}
                placeholderTextColor={colors.BLACK}
                placeholder="نقطة الانطلاق"
                value={fromFilter}
                onChangeText={(text) => setFromFilter(text)}
              />
              <TextInput
                style={styles.fromTofilterInput}
                placeholderTextColor={colors.BLACK}
                placeholder="نقطة الوصول"
                value={toFilter}
                onChangeText={(text) => setToFilter(text)}
              />
            </View>
          )}

          <FlatList
            data={activeTab === 'myTrips' ? filteredMyTrips : filteredEligibleTrips}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.available_trips_flatList_style}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={2}
            removeClippedSubviews={true}
            renderItem={renderTripItem}
            ListEmptyComponent={
              <View style={styles.no_trip_text_box}>
                <Text style={styles.no_trip_text}>
                  {activeTab === 'myTrips' ? 'ليس لديك رحلات حالياً' : 'لا توجد طلبات حالياً'}
                </Text>
              </View>
            }
          />
          {activeTab === 'myTrips' && (
            <TouchableOpacity style={styles.floatingAddButton} onPress={redirectToCreateNewTrip}>
              <AntDesign name="plus" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    )
  }
}

export default dailyTrips

const { width: SCwidth, height: SCheight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.WHITE,
    position: 'relative',
  },
  add_your_data_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  illustration_container:{
    width:250,
    height:250,
    justifyContent:'center',
    alignItems:'center',
    marginTop:25,
  },
  illustration:{
    width:230,
    height:230,
    resizeMode:'contain',
  },
  add_your_data_text_container:{
    width:'100%',
    height:100,
    justifyContent:'center',
    alignItems:'center',
  },
  add_your_data_text:{
    fontFamily: 'Cairo_400Regular',
    lineHeight:50
  },
  service_unavailable_container:{
    width:'100%',
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  service_unavailable_text:{
    width:300,
    lineHeight:40,
    borderRadius:15,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    backgroundColor:colors.GRAY
  },
  link_container: {
    width:110,
    height:40,
    marginTop:0,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:colors.DARKBLUE,
    borderRadius: 15,
  },
  link_text: {
    color:colors.WHITE,
    fontSize: 14,
    fontFamily: 'Cairo_700Bold',
    lineHeight: 35,
  },
  logo:{
    width:'100%',
    height:180,
    alignItems:'center',
    justifyContent:'center',
  },
  logo_image:{
    height:150,
    width:150,
    resizeMode:'contain',
  },
  intercity_trips_container:{
    width:'100%',
    alignItems:'center',
  },
  tripTabButtonsContainer: {
    width:300,
    marginBottom:20,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    gap:20,
  },
  tripTabButton: {
    width:135,
    height:42,
    justifyContent:'center',
    alignItems:'center',
  },
  activeTripTabButton: {
    borderBottomColor:'#295F98',
    borderBottomWidth:2
  },
  tripTabText: {
    lineHeight:42,
    fontFamily: 'Cairo_700Bold',
    fontSize: 15,
    color: colors.DARKGRAY,
  },
  activeTripTabText: {
    color:'#295F98'
  },
  dropdown:{
    width:250,
    height:40,
    borderWidth:1,
    marginBottom:20,
    borderColor:colors.BLACK,
    borderRadius:15,
  },
  dropdownStyle:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    fontSize:14
  },
  dropdownTextStyle:{
    textAlign:'center',
  },
  fromTofilterInputContainer:{
    flexDirection:'row-reverse',
    gap:10
  },
  fromTofilterInput:{
    width:160,
    height:50,
    marginBottom:15,
    borderWidth:1,
    borderColor:colors.BLACK,
    borderRadius:15,
    color:colors.BLACK,
    textAlign:'center',
    fontFamily:'Cairo_400Regular',
  },
  available_trips_flatList_style:{
    paddingBottom:140,
  },
  tripBox:{
    width:SCwidth - 35,
    height:350,
    marginBottom:15,
    borderRadius:15,
    alignItems:'center',
    borderColor:'#ddd',
    borderWidth:1,
    backgroundColor: '#fff',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  tripBox_header:{
    height:60,
    width:'90%',
    flexDirection:'row',
    justifyContent:'flex-end',
    alignItems:'center',
    gap:10,
  },
  tripBox_header_text:{
    lineHeight:40,
    fontFamily: 'Cairo_700Bold',
    fontSize:15
  },
  tripBox_status_box:{
    position:'absolute',
    top:0,
    left:0,
    width:100,
    height:40,
    alignItems:'center',
    justifyContent:'center',
    borderTopLeftRadius:15,
  },
  tripBox_status_text:{
    lineHeight:40,
    fontFamily: 'Cairo_400Regular',
    fontSize:15,
    color:colors.WHITE
  },
  tripBox_main:{
    width:'100%',
    height:210,
    marginVertical:8,
  },
  location_box:{
    flexDirection:'row',
    justifyContent:'flex-end',
    marginBottom:15,
  },
  location_text_box:{
    height:60,
    justifyContent:'space-between',
    alignItems:'flex-end',
  },
  location_icon_box:{
    height:60,
    width:50,
    justifyContent:'center',
    alignItems:'center',
  },
  trip_text_start_point_title:{
    lineHeight:30,
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
    color:colors.DARKGRAY
  },
  trip_text_start_point:{
    lineHeight:30,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
  },
  tripBox_footer:{
    width:'100%',
    height:60,
    flexDirection:'row-reverse',
    alignItems:'center',
    justifyContent:'center',
    borderTopWidth:1,
    borderTopColor:'#ddd'
  },
  tripBox_footer_section:{
    flex: 1,
    height:50,
    alignItems:'center',
    justifyContent:'center',
  },
  withSeparator: {
    borderLeftWidth: 1.5,
    borderLeftColor: '#ddd',
  },
  tripBox_footer_text_title:{
    lineHeight:25,
    fontFamily: 'Cairo_400Regular',
    fontSize:13,
    color:colors.DARKGRAY,
  },
  tripBox_footer_text:{
    lineHeight:25,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
  },
  tripBox_footer_button_text:{
    lineHeight:30,
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
    color:'#295F98'
  },
  no_trip_text_box:{
    height:400,
    justifyContent:'center',
  },
  no_trip_text:{
    width:300,
    lineHeight:40,
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:15
  },
  floatingAddButton: {
    position: 'absolute',
    top:600,
    right: 20,
    width: 50,
    height: 50,
    backgroundColor: '#295F98',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    zIndex: 100,
  },
  spinner_error_container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
})