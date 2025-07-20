import { Stack } from "expo-router"
import {LinesProvider} from '../stateManagment/LinesContext'

export default function MainLayout() {

  return(
    <LinesProvider>
      <Stack>
        <Stack.Screen name="(driver)" options={{headerShown:false}}/>
        <Stack.Screen name="(rider)" options={{headerShown:false}}/>
        <Stack.Screen name="driverAddNewLine" options={{headerShown:false}}/>
        <Stack.Screen name="driverCreateNewTrip" options={{headerShown:false}}/>
        <Stack.Screen name="riderCreateNewTrip" options={{headerShown:false}}/>
      </Stack>
    </LinesProvider>
  )
}