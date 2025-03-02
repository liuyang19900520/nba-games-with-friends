import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_social_accounts')
export class UserSocialAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  user_id: number;

  @Column({ length: 50 })
  provider: string;

  @Column({ length: 255 })
  provider_user_id: string;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @ManyToOne(() => User, user => user.socialAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
