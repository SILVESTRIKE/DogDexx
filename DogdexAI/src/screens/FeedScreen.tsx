// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   Button,
//   StyleSheet,
//   ScrollView,
  
//   StatusBar,
//   TouchableOpacity,
//   TextInput,
//   Image,
// } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { NativeStackScreenProps } from '@react-navigation/native-stack';
// import { FeedStackParamList } from '../navigation/FeedStack';
// import Ionicons from 'react-native-vector-icons/Ionicons';
// import PostItem from '../components/PostItem';
// import { postsData } from '../datas';

// type Props = NativeStackScreenProps<FeedStackParamList, 'FeedScreen'>;

// export default function FeedScreen({ navigation }: Props) {
//   const [activeTab, setActiveTab] = useState('NEW');

//   const tabs = ['NEW', 'FRIENDS', 'TOP', 'ACTIVE'];
//   const currentPosts = postsData[activeTab] || [];

//   return (
//     <SafeAreaView style={styles.container}>
//       <StatusBar barStyle="light-content" />

//       {/* Navigation Tabs */}
//       <View style={styles.navContainer}>
//         {tabs.map(tab => (
//           <TouchableOpacity
//             key={tab}
//             onPress={() => setActiveTab(tab)}
//             style={styles.navItem}
//           >
//             <Text
//               style={[
//                 styles.navText,
//                 activeTab === tab && styles.navTextActive,
//               ]}
//             >
//               {tab}
//             </Text>
//           </TouchableOpacity>
//         ))}
//       </View>

//       <ScrollView style={styles.content}>
//         {currentPosts.length > 0 ? (
//           currentPosts.map(post => <PostItem key={post.id} post={post} />)
//         ) : (
//           <View style={styles.emptyContainer}>
//             <Text style={styles.emptyText}>Không có bài viết nào</Text>
//           </View>
//         )}
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: '#000',
//   },
//   header: {
//     backgroundColor: '#000',
//     paddingVertical: 15,
//     paddingHorizontal: 20,
//     borderBottomWidth: 1,
//     borderBottomColor: '#333',
//   },
//   headerTitle: {
//     color: '#FFF',
//     fontSize: 24,
//     fontWeight: 'bold',
//     textAlign: 'center',
//   },
//   navContainer: {
//     flexDirection: 'row',
//     backgroundColor: '#000',
//     paddingHorizontal: 20,
//     paddingVertical: 10,
//     justifyContent: 'space-between',
//   },
//   navItem: {
//     flex: 1,
//     alignItems: 'center',
//   },
//   navText: {
//     color: '#666',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   navTextActive: {
//     color: '#FFF',
//   },
//   content: {
//     flex: 1,
//     backgroundColor: '#000',
//   },
//   emptyContainer: {
//     padding: 40,
//     alignItems: 'center',
//   },
//   emptyText: {
//     color: '#666',
//     fontSize: 16,
//   },
//   footer: {
//     padding: 20,
//     alignItems: 'center',
//     borderTopWidth: 1,
//     borderTopColor: '#333',
//     marginTop: 20,
//   },
//   footerTitle: {
//     color: '#FFF',
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginBottom: 10,
//   },
//   footerSubtitle: {
//     color: '#FFF',
//     fontSize: 14,
//     fontWeight: '600',
//     marginBottom: 5,
//   },
//   footerText: {
//     color: '#FFF',
//     fontSize: 12,
//     textAlign: 'center',
//     lineHeight: 18,
//     marginTop: 10,
//   },
// });
