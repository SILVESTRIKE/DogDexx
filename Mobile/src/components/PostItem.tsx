import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export interface Post {
  id: string;
  username: string;
  userAvatar?: string;
  postTime: string;
  postText: string;
  imageUrl: string;
  likes: number;
  comments: Comment[];
  isLiked: boolean;
}

export interface Comment {
  id: string;
  username: string;
  text: string;
  time: string;
}

interface PostItemProps {
  post: Post;
}

export default function PostItem({ post }: PostItemProps) {
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<Comment[]>(post.comments);

  const handleLike = () => {
    if (liked) {
      setLikeCount(likeCount - 1);
    } else {
      setLikeCount(likeCount + 1);
    }
    setLiked(!liked);
  };

  const handleAddComment = () => {
    if (comment.trim()) {
      const newComment: Comment = {
        id: (comments.length + 1).toString(),
        username: 'You',
        text: comment,
        time: 'vừa xong',
      };
      setComments([newComment, ...comments]);
      setComment('');
    }
  };

  return (
    <View style={styles.postContainer}>
      {/* User Info */}
      <View style={styles.userInfo}>
        <View style={styles.avatar} />
        <View>
          <Text style={styles.username}>{post.username}</Text>
          <Text style={styles.postTime}>{post.postTime}</Text>
        </View>
      </View>

      {/* Post Text */}
      <Text style={styles.postText}>{post.postText}</Text>

      {/* Dog Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: post.imageUrl }}
          style={styles.dogImage}
          resizeMode="cover"
        />
      </View>

      {/* Like and Comment Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={24}
            color={liked ? '#FF375F' : '#FFF'}
          />
          <Text style={styles.actionText}>{likeCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={22} color="#FFF" />
          <Text style={styles.actionText}>{comments.length}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-social-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Comment Input */}
      <View style={styles.commentInputContainer}>
        <TextInput
          style={styles.commentInput}
          placeholder="Thêm bình luận..."
          placeholderTextColor="#666"
          value={comment}
          onChangeText={setComment}
          multiline
        />
        <TouchableOpacity
          onPress={handleAddComment}
          style={styles.commentButton}
        >
          <Text style={styles.commentButtonText}>Đăng</Text>
        </TouchableOpacity>
      </View>

      {/* Comments List */}
      <View style={styles.commentsContainer}>
        <Text style={styles.commentsTitle}>Bình luận ({comments.length})</Text>
        {comments.map(item => (
          <View key={item.id} style={styles.commentItem}>
            <View style={styles.commentContent}>
              <Text style={styles.commentUsername}>{item.username}</Text>
              <Text style={styles.commentText}>{item.text}</Text>
              <Text style={styles.commentTime}>{item.time}</Text>
            </View>
            <TouchableOpacity>
              <Ionicons name="heart-outline" size={16} color="#666" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Divider between posts */}
      <View style={styles.postDivider} />
    </View>
  );
}

const styles = StyleSheet.create({
  postContainer: {
    padding: 15,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    marginRight: 10,
  },
  username: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  postText: {
    color: '#FFF',
    fontSize: 14,
    marginBottom: 15,
    lineHeight: 20,
  },
  imageContainer: {
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 15,
  },
  dogImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  actionText: {
    color: '#FFF',
    marginLeft: 6,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#333',
    marginVertical: 10,
  },
  commentInputContainer: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: '#FFF',
    marginRight: 10,
    maxHeight: 100,
  },
  commentButton: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  commentButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  commentsContainer: {
    padding: 15,
  },
  commentsTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  commentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  commentContent: {
    flex: 1,
    marginRight: 10,
  },
  commentUsername: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  commentText: {
    color: '#FFF',
    fontSize: 14,
    lineHeight: 18,
    marginBottom: 4,
  },
  commentTime: {
    color: '#666',
    fontSize: 12,
  },
  postDivider: {
    height: 8,
    backgroundColor: '#1A1A1A',
  },
});
