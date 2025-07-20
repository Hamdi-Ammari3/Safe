
import { StyleSheet,Text,View,Image,Dimensions} from 'react-native'
import nextTripImage from '../assets/images/trusted_driver.png'

const UpcomingTripComponent = ({destination,nextTripText}) => {
  return (
    <View style={styles.next_trip_box}>
        <View style={styles.illustration_container}>
          <Image source={nextTripImage} style={styles.illustration}/>
        </View>
        <View style={styles.next_trip_text_box}>
          <Text style={styles.next_trip_text}>
            رحلتك القادمة إلى {destination}
          </Text>        
          <Text style={styles.next_trip_counter_text}>{nextTripText}</Text>
        </View>            
    </View>
  )
}

export default UpcomingTripComponent

const { width: SCwidth, height: SCheight } = Dimensions.get('window')

const styles = StyleSheet.create({
  next_trip_box:{
    width:SCwidth,
    height:SCheight - 200,
    borderRadius:15,
    alignItems:'center',
    justifyContent:'center',
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
  next_trip_text_box:{
    height:60,
    marginTop:40,
    justifyContent:'space-between',
    alignItems:'center',
  },
  next_trip_text:{
    width:300,
    lineHeight:30,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
  },
  next_trip_counter_text:{
    width:300,
    lineHeight:30,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_700Bold',
    fontSize:14,
  },
})
