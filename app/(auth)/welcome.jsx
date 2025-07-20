import {useState} from 'react'
import { StyleSheet,View,Image,Text,TouchableOpacity } from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context"
import { router } from 'expo-router'
import logo from '../../assets/images/logo.jpg'
import riderService from '../../assets/images/ride_sharing_service.png'
import schedule from '../../assets/images/schedule.png'
import drivers from '../../assets/images/trusted_driver.png'
import trackTrip from '../../assets/images/track_trip.png'
import colors from '../../constants/Colors'
import AntDesign from '@expo/vector-icons/AntDesign'

const welcome = () => {

  const totalSteps = 4;
  const [currentPage, setCurrentPage] = useState(1)

  // Go to next page
  const handleNext = () => {
    if (currentPage < totalSteps) setCurrentPage(currentPage + 1)
  }
    
  // Return to previous page
  const handlePrevious = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1)
  }

  const onPressHandler = () => {
    router.push("(auth)/login")
  };

  // Render full pages
  const renderPage = () => {
    switch(currentPage) {
      case 1:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>خدمة نقل متكاملة</Text>
            <Text style={styles.text_content}>
              تطبيق "Safe" هو الحل الأمثل اللي يجمعك بسواقين موثوقين للخطوط و الرحلات اليومية.
            </Text>
            <View style={styles.illustration_container}>
              <Image source={riderService} style={styles.illustration}/>
            </View>
          </View>
        )
      case 2:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>خدمات منظمة</Text>
            <Text style={styles.text_content}>
              عن طريق تطبيقنا، تقدر تنظم مواعيد الرحلات وتتابع كل خطوة. كلش سهل!
            </Text>
            <View style={styles.illustration_container}>
              <Image source={schedule} style={styles.illustration}/>
            </View>
          </View>
        )
      case 3:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>سواقين موثوقين</Text>
            <Text style={styles.text_content}>
              سواقين مدربين ومختارين بعناية، نضمنلك الراحة والأمان وانت تتنقل.
            </Text>
            <View style={styles.illustration_container}>
              <Image source={drivers} style={styles.illustration}/>
            </View>
          </View>
        )
      case 4:
        return(
          <View style={styles.text_container}>
            <Text style={styles.text_title}>مراقبة الرحلة</Text>
            <Text style={styles.text_content}>مع تطبيقنا، عندك عين على كل شي! راقب رحلتك بوقت حقيقي وتطمن أكثر على أولادك.</Text>
            <View style={styles.illustration_container}>
              <Image source={trackTrip} style={styles.illustration}/>
            </View>         
          </View>
        )
      default:
        null;
    }
  }

  // Page indicator component
  const renderPageIndicator = () => {
    return (
      <View style={styles.page_indicator_container}>
        <View style={styles.page_indicator_buttons_container}>
          {currentPage > 1 && (
            <TouchableOpacity style={styles.page_indicator_button} onPress={handlePrevious}>
              <AntDesign name="left" size={24} color={colors.BLUE}/>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.page_indicator_dots}>
          {Array.from({ length: totalSteps }, (_, index) => (
            <View
              key={index}
              style={[
                styles.pageIndicator,
                currentPage === index + 1 ? styles.activeIndicator : styles.inactiveIndicator,
              ]}
            />
          ))}
        </View>
        <View style={styles.page_indicator_buttons_container}>
          {currentPage < totalSteps && (
            <TouchableOpacity style={styles.page_indicator_button} onPress={handleNext}>
              <AntDesign name="right" size={24} color={colors.BLUE}/>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.image_text_container}>
        <View style={styles.image_container}>
          <Image style={styles.image} source={logo}/>
        </View>
        {renderPage()}
        {renderPageIndicator()}
        <TouchableOpacity 
          style={styles.start_now_button}
          onPress={onPressHandler}
        >
          <Text style={styles.start_now_button_text}>ابدا الان</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

export default welcome

const styles = StyleSheet.create({
  container:{
    flex:1,
    backgroundColor:colors.WHITE,
  },
  image_text_container:{
    width:'100%',
    alignItems:'center',
    justifyContent:'center',
  },
  image_container:{
    width:'100%',
    height:160,
    alignItems:'center',
    justifyContent:'center',
    marginBottom:10
  },
  image:{
    width:150,
    height:150,
    resizeMode:'contain',
  },
  text_container:{
    width:'100%',
    height:400,
    justifyContent:'center',
    alignItems:'center',
  },
  text_title:{
    fontFamily:'Cairo_700Bold',
    textAlign:'center',
    marginBottom:20,
  },
  text_content:{
    width:'80%',
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    marginBottom:40,
  }, 
  illustration_container:{
    width:200,
    height:200,
    justifyContent:'center',
    alignItems:'center',
  },
  illustration:{
    width:200,
    height:200,
    resizeMode:'contain',
  },
  start_now_button:{
    width:120,
    height:40,
    justifyContent:'center',
    alignItems:'center',
    marginVertical:25,
    borderRadius:15,
    backgroundColor:colors.DARKBLUE
  },
  start_now_button_text:{
    lineHeight:40,
    fontFamily:'Cairo_400Regular',
    textAlign:'center',
    color:colors.WHITE
  },
  page_indicator_container:{ 
    width:300,
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems:'center',
  },
  page_indicator_dots:{
    width:100,
    flexDirection: 'row', 
    justifyContent: 'center', 
  },
  pageIndicator: { 
    width: 13, 
    height: 13, 
    borderRadius: 10,
    margin: 5 
  },
  activeIndicator: { 
    backgroundColor: colors.PRIMARY
  },
  inactiveIndicator: { 
    backgroundColor: '#CCC' 
  },
  page_indicator_buttons_container:{
    width:50,
    flexDirection:'row',
    justifyContent:'center',
    alignItems:'center',
  },
  page_indicator_button:{
    flexDirection:'row',
    alignItems:'center',
    justifyContent:'center'
  },
})
