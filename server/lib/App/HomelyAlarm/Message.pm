package App::HomelyAlarm::Message {
    use 5.016;
    
    use Moose;
    
    has 'message' => (
        is              => 'rw',
        isa             => 'Str',
        required        => 1
    );
    
    has 'title' => (
        is              => 'rw',
        isa             => 'Str',
        required        => 1
    );
    
    has 'language' => (
        is              => 'rw',
        isa             => 'Str',
        required        => 1,
        default         => 'en-US'
    );
    
    has 'recipients' => (
        is              => 'ro',
        isa             => 'ArrayRef[App::HomelyAlarm::Recipient]',
        required        => 1,
        default         => sub { [] },
        traits          => ['Array'],
        handles         => {
            push_recipient   => 'push',
            all_recipients  => 'elements',
        },
    );
    
    has 'type' => (
        is              => 'rw',
        isa             => 'Str',
        required        => 1
    );
    
    sub add_recipient {
        my ($self,$params) = @_;
        
        my $recipient = App::HomelyAlarm::Recipient->new(
            (
                map { $_ => $params->{$_} }
                grep { defined $params->{$_} }
                qw(email call sms)
            ),
            message     => $self,
        );
        $self->push_recipient($recipient);
        return $recipient;
    }
    
    sub process {
        my ($self) = @_;
        foreach my $recipient (@{$self->recipients}) {
            $recipient->process();
        }
    }
}

1;