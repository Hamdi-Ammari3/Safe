import {useState,useEffect} from 'react'
import { Alert,StyleSheet,View,ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { getDoc,doc } from 'firebase/firestore'
import { DB } from '../firebaseConfig'
import dayjs from '../utils/dayjs'
import colors from '../constants/Colors'
import LineWithoutDriver from './LineWithoutDriver'
import LinesFeed from './LinesFeed'
import UpcomingTripComponent from './UpcomingTripComponent'
import TrackTripComponent from './TrackTripComponent'
import ExpiredSubs from './ExpiredSubs'
import NoDataComponent from './NoDataComponent'

const toArabicNumbers = (num) => num.toString().replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d])

// ****  if we switch the line to driver B riders must track the new driver location and not the old one

const RiderLineStatus = ({rider}) => {
  const [nextTripText, setNextTripText] = useState("")
  const [returnTripText, setReturnTripText] = useState("")
  const [firstPhaseStarted,setFirstPhaseStarted] = useState(false)
  const [firstPhaseFinished,setFirstPhaseFinished] = useState(false)
  const [secondPhaseStarted,setSecondPhaseStarted] = useState(false)
  const [secondPhaseFinished,setSecondPhaseFinished] = useState(false)
  const [checkingDriverStatus,setCheckingDriverStatus] = useState(false)
  const [fetchingNextTripLoading,setFetchingNextTripLoading] = useState(false)
  const [fetchingReturnHomeTripLoading,setFetchingReturnHomeTripLoading] = useState(false)

  const createAlert = (alerMessage) => {
    Alert.alert(alerMessage)
  }

  const now = new Date();
  const endDate = rider?.service_period?.end_date?.toDate?.() || new Date(0);
  const isSubscriptionExpired = now > endDate;

  // Rider today status
  useEffect(() => {
    const checkTodayJourney = async () => {
      try {
        setCheckingDriverStatus(true)
        const iraqNow = dayjs().utcOffset(180);
        const yearMonthKey = `${iraqNow.year()}-${String(iraqNow.month() + 1).padStart(2, "0")}`;
        const dayKey = String(iraqNow.date()).padStart(2, "0");
  
        const driverDoc = await getDoc(doc(DB, "drivers", rider?.driver_id));
        if (!driverDoc.exists()) {
          setFirstPhaseStarted(false)
          setFirstPhaseFinished(false)
          setSecondPhaseStarted(false)
          setSecondPhaseFinished(false)
          return;
        }
  
        const driverData = driverDoc.data();
        const todayLines = driverData?.dailyTracking?.[yearMonthKey]?.[dayKey]?.today_lines || [];

        const riderLineStatus = todayLines.find(line => line.id === rider?.line_id);

        if (riderLineStatus) {
          setFirstPhaseStarted(!!riderLineStatus?.first_phase?.phase_started)
          setFirstPhaseFinished(!!riderLineStatus?.first_phase?.phase_finished)
          setSecondPhaseStarted(!!riderLineStatus?.second_phase?.phase_started)
          setSecondPhaseFinished(!!riderLineStatus?.second_phase?.phase_finished)
        } else {
          setFirstPhaseStarted(false)
          setFirstPhaseFinished(false)
          setSecondPhaseStarted(false)
          setSecondPhaseFinished(false)
        }
      } catch (error) {
        createAlert("حدث خطأ أثناء التحقق من حالة الرحلة اليوم.");
      } finally {
        setCheckingDriverStatus(false)
      }
    }
  
    if (rider?.driver_id) {
      checkTodayJourney();
    }
  }, [rider?.driver_id])

  // Next trip date
  useEffect(() => {
    const fetchNextTrip = async () => {
      if (!rider?.driver_id || rider?.trip_status !== "at home" || !rider?.line_id) return;
      try {
        setFetchingNextTripLoading(true)
        const lineSnap = await getDoc(doc(DB, "lines", rider.line_id));
        if (!lineSnap.exists()) {
          setNextTripText("لا توجد رحلة قادمة");
          return;
        }

        const lineData = lineSnap.data();
        const timetable = lineData?.timeTable || [];

        if (!timetable.length) {
          setNextTripText("لا توجد رحلة قادمة");
          return;
        }

        const now = new Date();
        const todayIndex = now.getDay(); // 0=Sunday, ..., 6=Saturday
        const sortedTimetable = [...timetable].sort((a, b) => a.id - b.id);

        let nextTripDay = null;
        let tripLabel = "لا توجد رحلة قادمة";

        const formatTimeWithPeriod = (date) => {
          let hours = date.getHours();
          let minutes = date.getMinutes();
          const period = hours >= 12 ? "مساءً" : "صباحًا";
          hours = hours % 12 || 12;
          return `${toArabicNumbers(hours.toString().padStart(2, "0"))}:${toArabicNumbers(minutes.toString().padStart(2, "0"))} ${period}`;
        };

        // Step 1: Check today's trip
        const todaySchedule = sortedTimetable.find(day => day.dayIndex === todayIndex && day.active);
        if (todaySchedule && todaySchedule.startTime) {
          let startTimeDate = todaySchedule.startTime.toDate();
          const nowHours = now.getHours();
          const nowMinutes = now.getMinutes();

          let startHours = startTimeDate.getHours();
          let startMinutes = startTimeDate.getMinutes();

          if (startHours > nowHours || (startHours === nowHours && startMinutes > nowMinutes)) {
            nextTripDay = "اليوم";
            tripLabel = `${nextTripDay} الساعة ${formatTimeWithPeriod(startTimeDate)}`;
          }
        }

        // Step 2: Find the next upcoming trip if today's passed
        if (!nextTripDay) {
          for (let i = 1; i <= 7; i++) {
            let nextIndex = (todayIndex + i) % 7;
            const nextDay = sortedTimetable.find(day => day.dayIndex === nextIndex && day.active);
            if (nextDay && nextDay.startTime) {
              let startTimeDate = nextDay.startTime.toDate();
              nextTripDay = i === 1 ? "غدا" : nextDay.day;
              tripLabel = `${nextTripDay} الساعة ${formatTimeWithPeriod(startTimeDate)}`;
              break;
            }
          }
        }

        setNextTripText(tripLabel);
      } catch (err) {
        setNextTripText("لا توجد رحلة قادمة");
      } finally {
        setFetchingNextTripLoading(false)
      }
    };

    fetchNextTrip();
  }, [rider?.trip_status, rider?.driver_id, rider?.line_id])

  // Next return to home trip date
  useEffect(() => {
    const fetchReturnTrip = async () => {
      if (!rider?.driver_id || rider?.trip_status !== "at destination" || !rider?.line_id) return;
      try {
        setFetchingReturnHomeTripLoading(true)
        const lineSnap = await getDoc(doc(DB, "lines", rider.line_id));
        if (!lineSnap.exists()) {
          setReturnTripText("لا توجد رحلة عودة");
          return;
        }

        const lineData = lineSnap.data();
        const timetable = lineData?.timeTable || [];

        if (!timetable.length) {
          setReturnTripText("لا توجد رحلة عودة");
          return;
        }

        const now = new Date();
        const todayIndex = now.getDay(); // 0 = Sunday, ..., 6 = Saturday
        const sortedTimetable = [...timetable].sort((a, b) => a.id - b.id);
        let returnTripDay = null;
        let tripLabel = "لا توجد رحلة عودة";

        const formatTimeWithPeriod = (date) => {
          let hours = date.getHours();
          let minutes = date.getMinutes();
          const period = hours >= 12 ? "مساءً" : "صباحًا";
          hours = hours % 12 || 12;
          return `${toArabicNumbers(hours.toString().padStart(2, "0"))}:${toArabicNumbers(minutes.toString().padStart(2, "0"))} ${period}`;
        };

        // Step 1: Check today's return time first
        const todaySchedule = sortedTimetable.find(day => day.dayIndex === todayIndex && day.active);
        
        if (todaySchedule && todaySchedule.endTime) {
          let endTimeDate = todaySchedule.endTime.toDate();
          const nowHours = now.getHours();
          const nowMinutes = now.getMinutes();
          const endHours = endTimeDate.getHours();
          const endMinutes = endTimeDate.getMinutes();

          if (endHours > nowHours || (endHours === nowHours && endMinutes > nowMinutes)) {
            returnTripDay = "اليوم";
            tripLabel = `${returnTripDay} الساعة ${formatTimeWithPeriod(endTimeDate)}`;
          }
        }

        // Step 2: Find next available return time if today's has passed
        if (!returnTripDay) {
          for (let i = 1; i <= 7; i++) {
            let nextIndex = (todayIndex + i) % 7;
            const nextDay = sortedTimetable.find(day => day.dayIndex === nextIndex && day.active);

            if (nextDay && nextDay.endTime) {
              let endTimeDate = nextDay.endTime.toDate();
              returnTripDay = i === 1 ? "غدا" : nextDay.day;
              tripLabel = `${returnTripDay} الساعة ${formatTimeWithPeriod(endTimeDate)}`;
              break;
            }
          }
        }

        setReturnTripText(tripLabel);
      } catch (err) {
        setReturnTripText("لا توجد رحلة عودة");
      } finally{
        setFetchingReturnHomeTripLoading(false)
      }
    };

    fetchReturnTrip();
  }, [rider?.trip_status, rider?.driver_id, rider?.line_id])

  //Centralized rider status
  const getRiderPhaseStatus = () => {
    if(!rider.line_id) return 'no_line_yet';

    if(!rider.driver_id) return 'no_driver_yet';

    if(isSubscriptionExpired) return 'expired_subs';

    if (!firstPhaseStarted && !firstPhaseFinished && !secondPhaseStarted && !secondPhaseFinished)
      return 'before_trip';

    if (firstPhaseStarted && !firstPhaseFinished && !secondPhaseStarted && !secondPhaseFinished) {
      if (rider.trip_status === 'at home' && !rider.checked_at_home) return 'driver_started_first_phase';
      if (rider.trip_status === 'at home' && rider.checked_at_home) return 'missed_pickup';
    }

    if (rider.trip_status === 'to destination') return 'to_school';
    if (rider.trip_status === 'at destination') return 'at_school_waiting_return';
    if (rider.trip_status === 'to home') return 'to_home';
    if (rider.trip_status === 'at home') return 'complete';

    return 'unknown';
  }

  const RiderLineStatus = () => {
    const status = getRiderPhaseStatus()

    switch (status) {
      case 'no_line_yet':
        return <LinesFeed rider={rider}/>
      case 'no_driver_yet':
        return <LineWithoutDriver rider={rider}/>
      case 'expired_subs':
        return <ExpiredSubs/>
      case 'before_trip':
        return <UpcomingTripComponent destination={rider.destination} nextTripText={nextTripText} />;
      case 'driver_started_first_phase':
        return <TrackTripComponent rider={rider} text="السائق بدا رحلة الذهاب" />;
      case 'missed_pickup':
        return <UpcomingTripComponent destination={rider.destination} nextTripText={nextTripText} />;
      case 'to_school':
        return <TrackTripComponent rider={rider} text={`الراكب في الطريق إلى ${rider.destination}`} />;
      case 'at_school_waiting_return':
        return <UpcomingTripComponent destination='المنزل' nextTripText={returnTripText} />;
      case 'to_home':
        return <TrackTripComponent rider={rider} text="الراكب في الطريق إلى المنزل" />;
      case 'complete':
        return <UpcomingTripComponent destination={rider.destination} nextTripText={nextTripText} />;
      default:
        return <NoDataComponent />;
    }
  }
 
  if(checkingDriverStatus || fetchingNextTripLoading || fetchingReturnHomeTripLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.spinner_container}>
          <ActivityIndicator size="large" color={colors.PRIMARY} />
        </View>
      </SafeAreaView>
    )
  }

  return(
    <SafeAreaView style={styles.container}>
      {RiderLineStatus()}
    </SafeAreaView>
  )
}

export default RiderLineStatus

const styles = StyleSheet.create({
  container:{
    flex:1,
  },
  spinner_container:{
    width:300,
    height:500,
    alignItems:'center',
    justifyContent:'center',
  }
})
