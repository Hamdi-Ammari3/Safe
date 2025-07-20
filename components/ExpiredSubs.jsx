import { Text,View,StyleSheet,Image,Dimensions } from 'react-native'
import noDataImage from '../assets/images/nothing.png'

const ExpiredSubs = () => {
  return (
    <View style={styles.next_trip_box}>
      <View style={styles.illustration_container}>
        <Image source={noDataImage} style={styles.illustration}/>
      </View>
      <View style={styles.next_trip_text_box}>
        <Text style={[styles.next_trip_text,{fontFamily:'Cairo_700Bold'}]}>انتهى اشتراكك الشهري</Text>
        <Text style={styles.next_trip_text}>يرجى تجديد الاشتراك للاستمرار في التمتع بالخدمة.</Text>
      </View>
    </View>
  )
}

export default ExpiredSubs

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
    marginTop:20,
    justifyContent:'space-between',
    alignItems:'center',
  },
  next_trip_text:{
    width:300,
    lineHeight:40,
    verticalAlign:'middle',
    textAlign:'center',
    fontFamily: 'Cairo_400Regular',
    fontSize:14,
  },
})
