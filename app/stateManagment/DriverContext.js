import { createContext, useState, useEffect, useContext } from 'react';
import { collection,onSnapshot,getDocs,query,where,Timestamp } from 'firebase/firestore';
import {DB} from '../../firebaseConfig'
import { useUser } from '@clerk/clerk-expo';

// Create the context
const DriverContext = createContext()

// Provider component
export const DriverProvider = ({ children }) => {
  const { user } = useUser()

  const [driverData, setDriverData] = useState([])
  const [fetchingDriverDataLoading,setFetchingDriverDataLoading] = useState(true)

  const [userData, setUserData] = useState(null)
  const [fetchingUserDataLoading, setFetchingUserDataLoading] = useState(true)

  const [myTrips,setMyTrips] = useState(null)
  const [fetchingMyTrips,setFetchingMyTrips] = useState(true)

  const [eligibleTrips,setEligibleTrips] = useState(null)
  const [fetchingEligibleTrips,setFetchingEligibleTrips] = useState(true)
  
  const [error, setError] = useState(null)

  // Fetch user data once
  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const userInfoCollectionRef = collection(DB, 'users')
          const q = query(userInfoCollectionRef , where('user_id', '==', user.id))
          const userInfoSnapshot = await getDocs(q)

          if (!userInfoSnapshot.empty) {
            const userData = userInfoSnapshot.docs[0].data();
            setUserData(userData);
          } else {
            setError('No user data found');
          }
        } catch (error) {
          setError('Failed to load user data. Please try again.');
        } finally {
            setFetchingUserDataLoading(false);
        }
      }
    };

    fetchUserData();
  }, [user]);
  
  // Fetch driver data once
  useEffect(() => {
    if (!user) {
      setError('User is not defined')
      setFetchingDriverDataLoading(false)
      return;
    }

    const driverInfoCollectionRef = collection(DB, 'drivers')
    const unsubscribe = onSnapshot(
      driverInfoCollectionRef,
      (querySnapshot) => {
        const driverList = querySnapshot.docs
          ?.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          ?.filter((driver) => driver.user_id === user.id);

        setDriverData(driverList)
        setFetchingDriverDataLoading(false)
      },
      (error) => {
        setError('Failed to load drivers. Please try again.')
        setFetchingDriverDataLoading(false)
      }
    );

    return () => unsubscribe();
  }, [user]);

  //Fetch driver's trips
  useEffect(() => {
    if (!driverData?.length){
      setFetchingMyTrips(false)
      return
    } 

    const driverID = driverData[0].id;

    const tripsRef = query(
      collection(DB, 'intercityTrips'),
      where('driver_id', '==', driverID),
      where('payed','==',false)
    )

    const unsubscribe = onSnapshot(tripsRef, (querySnapshot) => {
      const trips = querySnapshot.docs?.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMyTrips(trips);
      setFetchingMyTrips(false);
    });

    return () => unsubscribe();
  }, [driverData]);

  //Fetch driver's eligible trips
  useEffect(() => {
    if (!driverData?.length) {
      setFetchingEligibleTrips(false);
      return;
    } 
    
    const nowTimestamp = Timestamp.fromDate(new Date())

    const tripsRef = query(
      collection(DB, 'intercityTrips'),
      where('driver_id', '==', null),
      where('start_datetime', '>', nowTimestamp)
    )

    const unsubscribe = onSnapshot(tripsRef, (querySnapshot) => {
      const trips = querySnapshot.docs?.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }))
      setEligibleTrips(trips);
      setFetchingEligibleTrips(false);
    })

    return () => unsubscribe();
  }, [driverData]);

  return (
    <DriverContext.Provider value={{ 
      userData,
      fetchingUserDataLoading,
      driverData, 
      fetchingDriverDataLoading,
      myTrips,
      fetchingMyTrips,
      eligibleTrips,
      fetchingEligibleTrips,
      error 
    }}>
      {children}
    </DriverContext.Provider>
  );
};

// Custom hook to use driver context
export const useDriverData = () => {
  return useContext(DriverContext);
};

export default DriverContext;
