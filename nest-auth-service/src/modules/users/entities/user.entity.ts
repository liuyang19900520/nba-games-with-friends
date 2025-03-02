import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserSocialAccount } from './user-social-account.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ length: 50 })
  phone: string;

  @Column({ length: 50 })
  nick_name: string;

  @Column({ length: 255 })
  password: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => UserSocialAccount, (socialAccount) => socialAccount.user)
  socialAccounts: UserSocialAccount[];
}
