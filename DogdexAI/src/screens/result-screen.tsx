// "use client"

// import { useState, useEffect } from "react"
// import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StyleSheet, ActivityIndicator } from "react-native"
// import { apiClient } from "../lib/api-client"

// const ResultsScreen = ({ route, navigation }: any) => {
//   const { predictionId } = route.params
//   const [results, setResults] = useState<any>(null)
//   const [loading, setLoading] = useState(true)

//   useEffect(() => {
//     loadResults()
//   }, [predictionId])

//   const loadResults = async () => {
//     try {
//       const data = await apiClient.getResults(predictionId)
//       setResults(data)
//     } catch (error) {
//       console.error("Failed to load results:", error)
//     } finally {
//       setLoading(false)
//     }
//   }

//   if (loading) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <View style={styles.loadingContainer}>
//           <ActivityIndicator size="large" color="#3b82f6" />
//           <Text style={styles.loadingText}>Loading results...</Text>
//         </View>
//       </SafeAreaView>
//     )
//   }

//   return (
//     <SafeAreaView style={styles.container}>
//       <ScrollView style={styles.scrollView}>
//         <View style={styles.resultsCard}>
//           <Text style={styles.title}>Detection Results</Text>

//           {results && (
//             <View>
//               <View style={styles.resultItem}>
//                 <Text style={styles.label}>Status:</Text>
//                 <Text style={styles.value}>{results.status}</Text>
//               </View>

//               {results.detections && (
//                 <View style={styles.resultItem}>
//                   <Text style={styles.label}>Detections Found:</Text>
//                   <Text style={styles.value}>{results.detections.length}</Text>
//                 </View>
//               )}
//             </View>
//           )}

//           <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
//             <Text style={styles.backButtonText}>Back to Home</Text>
//           </TouchableOpacity>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   )
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: "#fff",
//   },
//   scrollView: {
//     padding: 16,
//   },
//   loadingContainer: {
//     flex: 1,
//     justifyContent: "center",
//     alignItems: "center",
//   },
//   loadingText: {
//     marginTop: 12,
//     fontSize: 14,
//     color: "#666",
//   },
//   resultsCard: {
//     backgroundColor: "#f9fafb",
//     padding: 16,
//     borderRadius: 8,
//     borderWidth: 1,
//     borderColor: "#e5e5e5",
//   },
//   title: {
//     fontSize: 20,
//     fontWeight: "700",
//     marginBottom: 16,
//   },
//   resultItem: {
//     marginBottom: 12,
//     paddingBottom: 12,
//     borderBottomWidth: 1,
//     borderBottomColor: "#e5e5e5",
//   },
//   label: {
//     fontSize: 12,
//     fontWeight: "600",
//     color: "#666",
//     marginBottom: 4,
//   },
//   value: {
//     fontSize: 14,
//     fontWeight: "500",
//     color: "#000",
//   },
//   backButton: {
//     marginTop: 24,
//     backgroundColor: "#3b82f6",
//     paddingVertical: 12,
//     borderRadius: 8,
//     alignItems: "center",
//   },
//   backButtonText: {
//     color: "#fff",
//     fontSize: 14,
//     fontWeight: "600",
//   },
// })

// export default ResultsScreen
