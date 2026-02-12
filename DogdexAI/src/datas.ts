import { ScanItem } from './types';

export const scanList: ScanItem[] = [
  {
    id: '1',
    timestamp: 'cách đây 16 giờ',
    label: 'Chó Corgi Pembroke Wales',
    percentage: '91,8% Match',
    furtherMatches: 'Further matches: Chó Corgi xứ Wales cổ (5,7%)',
  },
  {
    id: '2',
    timestamp: 'cách đây 16 giờ',
    label: 'Chó Bulldog Anh',
    percentage: '85,2% Match',
    furtherMatches: 'Further matches: Chó Bulldog Pháp (12,1%)',
  },
  {
    id: '3',
    timestamp: 'cách đây 16 giờ',
    label: 'Chó Poodle',
    percentage: '78,9% Match',
    furtherMatches: 'Further matches: Chó Poodle lai (8,3%)',
  },
];

import { DogBreed } from './types';

export const supportedBreeds: DogBreed[] = [
  {
    id: '1',
    name: 'Aktia Inu11',
    fciNumber: '255',
    imageUrl: '',
  },
  { id: '2', name: 'Alabai', fciNumber: '335', imageUrl: '' },
  { id: '3', name: 'Alaska Malamute', fciNumber: '243', imageUrl: '' },
  { id: '4', name: 'American Akita', fciNumber: '344', imageUrl: '' },
  { id: '5', name: 'American Cocker Spaniel', fciNumber: '167', imageUrl: '' },
  {
    id: '6',
    name: 'American Staffordshire Terrier',
    fciNumber: '286',
    imageUrl: '',
  },
  {
    id: '7',
    name: 'Anglo-Français de Petite Vénerie',
    fciNumber: '325',
    imageUrl: '',
  },
  {
    id: '8',
    name: 'Austrian Black and Tan Hound',
    fciNumber: '63',
    imageUrl: '',
  },
  { id: '9', name: 'Aktia Inu', fciNumber: '255', imageUrl: '' },
  { id: '10', name: 'Alabai', fciNumber: '335', imageUrl: '' },
  { id: '11', name: 'Alaska Malamute', fciNumber: '243', imageUrl: '' },
  { id: '12', name: 'American Akita', fciNumber: '344', imageUrl: '' },
  { id: '13', name: 'American Cocker Spaniel', fciNumber: '167', imageUrl: '' },
  {
    id: '14',
    name: 'American Staffordshire Terrier',
    fciNumber: '286',
    imageUrl: '',
  },
  {
    id: '15',
    name: 'Anglo-Français de Petite Vénerie',
    fciNumber: '325',
    imageUrl: '',
  },
  {
    id: '16',
    name: 'Austrian Black and Tan Hound',
    fciNumber: '63',
    imageUrl: '',
  },
  { id: '17', name: 'Aktia Inu', fciNumber: '255', imageUrl: '' },
  { id: '18', name: 'Alabai', fciNumber: '335', imageUrl: '' },
  { id: '19', name: 'Alaska Malamute', fciNumber: '243', imageUrl: '' },
  { id: '20', name: 'American Akita', fciNumber: '344', imageUrl: '' },
  { id: '21', name: 'American Cocker Spaniel', fciNumber: '167', imageUrl: '' },
  {
    id: '22',
    name: 'American Staffordshire Terrier',
    fciNumber: '286',
    imageUrl: '',
  },
  {
    id: '23',
    name: 'Anglo-Français de Petite Vénerie',
    fciNumber: '325',
    imageUrl: '',
  },
  {
    id: '24',
    name: 'Austrian Black and Tan Hound',
    fciNumber: '63',
    imageUrl: '',
  },
];


import { Post } from '../src/components/PostItem';

export const postsData: { [key: string]: Post[] } = {
  NEW: [
    {
      id: '1',
      username: '✰ The.Tale.of.Tails ✰',
      postTime: 'cách đây 2 phút',
      postText: "Let's not spread hate loves",
      imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=400',
      likes: 42,
      isLiked: false,
      comments: [
        {
          id: '1',
          username: 'Basil The Chow',
          text: "why're we being homophobic",
          time: '2 phút',
        },
        {
          id: '2',
          username: 'DogLover123',
          text: 'Beautiful dog! 🐕',
          time: '5 phút',
        },
      ],
    },
    {
      id: '2',
      username: 'Golden Retriever Lovers',
      postTime: 'cách đây 15 phút',
      postText: 'My happy boy enjoying the sunshine! ☀️',
      imageUrl: 'https://images.unsplash.com/photo-1534351450181-ea9c784193a9?w=400',
      likes: 128,
      isLiked: true,
      comments: [
        {
          id: '1',
          username: 'SunshineGirl',
          text: 'So adorable! 😍',
          time: '10 phút',
        },
      ],
    },
  ],
  FRIENDS: [
    {
      id: '3',
      username: 'Poodle Paradise',
      postTime: 'cách đây 1 giờ',
      postText: 'Grooming day! Looking fresh 💇‍♀️',
      imageUrl: 'https://images.unsplash.com/photo-1517423568366-8b83523034fd?w=400',
      likes: 89,
      isLiked: false,
      comments: [
        {
          id: '1',
          username: 'BestFriend',
          text: 'Looking gorgeous! 💫',
          time: '45 phút',
        },
      ],
    },
    {
      id: '4',
      username: 'Husky Adventures',
      postTime: 'cách đây 3 giờ',
      postText: 'Snow day = best day! ❄️',
      imageUrl: 'https://images.unsplash.com/photo-1517423738875-5ce310acd3da?w=400',
      likes: 256,
      isLiked: true,
      comments: [
        {
          id: '1',
          username: 'SnowLover',
          text: 'My husky would love this!',
          time: '2 giờ',
        },
        {
          id: '2',
          username: 'WinterFan',
          text: 'Beautiful scenery!',
          time: '1 giờ',
        },
      ],
    },
  ],
  TOP: [
    {
      id: '5',
      username: 'Corgi Crew',
      postTime: 'cách đây 1 ngày',
      postText: 'Butt too powerful for this world 🍑',
      imageUrl: 'https://images.unsplash.com/photo-1612536057832-2ff7ead58194?w=400',
      likes: 1024,
      isLiked: false,
      comments: [
        {
          id: '1',
          username: 'CorgiFanatic',
          text: 'THE CUTEST THING EVER!',
          time: '20 giờ',
        },
        {
          id: '2',
          username: 'DogMom',
          text: 'I want a corgi so bad!',
          time: '18 giờ',
        },
        {
          id: '3',
          username: 'PetLover',
          text: 'This made my day!',
          time: '15 giờ',
        },
      ],
    },
    {
      id: '6',
      username: 'Beagle Brigade',
      postTime: 'cách đây 2 ngày',
      postText: 'When you smell something interesting 👃',
      imageUrl: 'https://images.unsplash.com/photo-1554342321-0776d282ceac?w=400',
      likes: 876,
      isLiked: true,
      comments: [
        {
          id: '1',
          username: 'BeagleOwner',
          text: 'Classic beagle pose!',
          time: '1 ngày',
        },
      ],
    },
  ],
  ACTIVE: [
    {
      id: '7',
      username: 'Border Collie Brainiac',
      postTime: 'cách đây 30 phút',
      postText: 'Learning new tricks! So smart 🧠',
      imageUrl: 'https://images.unsplash.com/photo-1560743641-3914f2c45636?w=400',
      likes: 67,
      isLiked: false,
      comments: [
        {
          id: '1',
          username: 'TrainerPro',
          text: 'Great technique!',
          time: '25 phút',
        },
        {
          id: '2',
          username: 'DogWhisperer',
          text: 'What a smart pup!',
          time: '20 phút',
        },
      ],
    },
    {
      id: '8',
      username: 'Dachshund Daily',
      postTime: 'cách đây 1 giờ',
      postText: 'Long dog, long nap 😴',
      imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400',
      likes: 143,
      isLiked: false,
      comments: [
        {
          id: '1',
          username: 'NapExpert',
          text: 'Sleeping goals!',
          time: '45 phút',
        },
      ],
    },
  ],
};